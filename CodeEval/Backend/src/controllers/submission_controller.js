const path = require("path");
const fs = require("fs");
const { pool } = require("../config/db");

function languageFromFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".py") return "python";
  if (ext === ".cpp") return "cpp";
  return "unknown";
}

function cleanupUploadedFiles(files) {
  (files || []).forEach((file) => {
    if (!file?.path) return;
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (_error) {
      // Best-effort cleanup only.
    }
  });
}

async function uploadSubmission(req, res) {
  const assignmentId = Number(req.body.assignment_id);
  const studentId = req.user.user_id;
  const files = req.files || [];

  if (!assignmentId) {
    return res.status(400).json({ success: false, message: "assignment_id is required" });
  }
  if (!files.length) {
    return res.status(400).json({ success: false, message: "At least one code file is required" });
  }

  const existingSubmission = await pool.query(
    `SELECT submission_id
     FROM submissions
     WHERE assignment_id = $1
       AND student_id = $2
     LIMIT 1`,
    [assignmentId, studentId],
  );
  if (existingSubmission.rows.length > 0) {
    cleanupUploadedFiles(files);
    return res.status(409).json({
      success: false,
      message: "You have already submitted this assignment.",
    });
  }

  const parsedFiles = files.map((file) => ({
    originalName: file.originalname,
    path: file.path,
    language: languageFromFile(file.originalname),
  }));
  const hasInvalid = parsedFiles.some((f) => !["python", "cpp"].includes(f.language));
  if (hasInvalid) {
    return res.status(400).json({ success: false, message: "Only .py and .cpp files are allowed" });
  }
  const filePaths = parsedFiles.map((f) => path.resolve(f.path));
  const languageSet = [...new Set(parsedFiles.map((f) => f.language))];
  const language = languageSet.length === 1 ? languageSet[0] : "mixed";

  const inserted = await pool.query(
    `INSERT INTO submissions (assignment_id, student_id, file_path, language, status)
     VALUES ($1, $2, $3, $4, 'Pending')
     RETURNING submission_id`,
    [assignmentId, studentId, JSON.stringify(filePaths), language],
  );

  const submissionId = inserted.rows[0].submission_id;

  return res.status(201).json({
    success: true,
    submission_id: submissionId,
    status: "pending",
    files_received: filePaths.length,
  });
}

async function getMySubmissions(req, res) {
  const studentId = req.user.user_id;
  const result = await pool.query(
    `SELECT s.submission_id AS id,
            COALESCE(a.title, 'Assignment') AS assignment,
            TO_CHAR(s.submitted_at, 'YYYY-MM-DD HH24:MI') AS date,
            CASE
              WHEN s.status = 'Pending' THEN 'pending'
              WHEN s.status = 'Evaluated' THEN 'completed'
              WHEN s.status = 'Error' THEN 'failed'
              ELSE LOWER(s.status)
            END AS status,
            e.total_score AS grade
     FROM submissions s
     LEFT JOIN assignments a ON a.assignment_id = s.assignment_id
     LEFT JOIN evaluations e ON e.submission_id = s.submission_id
     WHERE s.student_id = $1
     ORDER BY s.submitted_at DESC`,
    [studentId],
  );
  return res.json({ success: true, submissions: result.rows });
}

async function getSubmissionStats(req, res) {
  const studentId = req.user.user_id;
  const [countResult, statusResult] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM submissions WHERE student_id = $1", [studentId]),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Evaluated')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending
       FROM submissions
       WHERE student_id = $1`,
      [studentId],
    ),
  ]);

  return res.json({
    success: true,
    total: countResult.rows[0].total,
    completed: statusResult.rows[0].completed,
    pending: statusResult.rows[0].pending,
  });
}

async function getAssignments(req, res) {
  const studentId = req.user.user_id;
  const result = await pool.query(
    `SELECT
       assignment_id::text AS id,
       title AS name,
       title,
       COALESCE(description, '') AS description,
       language,
       due_date
     FROM assignments
     WHERE assignment_id NOT IN (
       SELECT assignment_id
       FROM submissions
       WHERE student_id = $1
     )
     ORDER BY created_at DESC`,
    [studentId],
  );
  return res.json({ success: true, assignments: result.rows });
}

async function getAssignmentDetails(req, res) {
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) {
    return res.status(400).json({ success: false, message: "Invalid assignment id" });
  }

  const assignmentResult = await pool.query(
    `SELECT
       a.assignment_id AS id,
       a.title,
       COALESCE(a.description, '') AS description,
       a.language,
       a.due_date,
       a.created_at,
       u.full_name AS instructor_name,
       ad.file_path AS pdf_path,
       r.rubric_id,
       r.correctness_weight,
       r.style_weight,
       r.efficiency_weight,
       r.readability_weight,
       r.total_weight
     FROM assignments a
     LEFT JOIN users u ON u.user_id = a.instructor_id
     LEFT JOIN assignment_documents ad ON ad.assignment_id = a.assignment_id
     LEFT JOIN rubrics r ON r.rubric_id = a.rubric_id
     WHERE a.assignment_id = $1`,
    [assignmentId],
  );

  if (!assignmentResult.rows.length) {
    return res.status(404).json({ success: false, message: "Assignment not found" });
  }

  const statsResult = await pool.query(
    `SELECT
       COUNT(s.submission_id)::int AS submissions,
       COUNT(*) FILTER (WHERE s.status = 'Pending')::int AS pending,
       AVG(e.total_score) AS avg_grade
     FROM submissions s
     LEFT JOIN evaluations e ON e.submission_id = s.submission_id
     WHERE s.assignment_id = $1`,
    [assignmentId],
  );

  const assignment = assignmentResult.rows[0];
  const stats = statsResult.rows[0];

  return res.json({
    success: true,
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      language: assignment.language,
      dueDate: assignment.due_date,
      createdAt: assignment.created_at,
      instructorName: assignment.instructor_name || "Unknown instructor",
      submissions: stats.submissions || 0,
      pending: stats.pending || 0,
      avgGrade: stats.avg_grade ? Number(stats.avg_grade) : null,
      hasPdf: Boolean(assignment.pdf_path),
      rubric: assignment.rubric_id
        ? {
            rubricId: Number(assignment.rubric_id),
            correctness: Number(assignment.correctness_weight ?? 0),
            style: Number(assignment.style_weight ?? 0),
            efficiency: Number(assignment.efficiency_weight ?? 0),
            readability: Number(assignment.readability_weight ?? 0),
            total: Number(assignment.total_weight ?? 0),
          }
        : null,
    },
  });
}

async function getAssignmentPdf(req, res) {
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) {
    return res.status(400).json({ success: false, message: "Invalid assignment id" });
  }

  const result = await pool.query(
    "SELECT file_path FROM assignment_documents WHERE assignment_id = $1",
    [assignmentId],
  );

  if (!result.rows.length || !result.rows[0].file_path) {
    return res.status(404).json({ success: false, message: "Assignment PDF not found" });
  }

  const filePath = path.resolve(result.rows[0].file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "Assignment PDF file missing on disk" });
  }

  return res.sendFile(filePath);
}

module.exports = {
  uploadSubmission,
  getMySubmissions,
  getSubmissionStats,
  getAssignments,
  getAssignmentDetails,
  getAssignmentPdf,
};
