const { pool } = require("../config/db");

function normalizeSubmissionStatus(status) {
  if (status === "Evaluated") return "completed";
  if (status === "Pending") return "pending";
  if (status === "Error") return "failed";
  return "pending";
}

async function getDashboardAssignments(req, res) {
  const instructorId = Number(req.query.instructorId);
  if (!instructorId) {
    return res.status(400).json({ error: "instructorId is required" });
  }

  const result = await pool.query(
    `SELECT
       a.assignment_id AS id,
       a.title,
       COALESCE(a.description, '') AS description,
       a.language,
       a.due_date AS "dueDate",
       COUNT(s.submission_id)::int AS submissions,
       COUNT(*) FILTER (WHERE s.status = 'Pending')::int AS pending,
       AVG(e.total_score) AS "avgGrade"
     FROM assignments a
     LEFT JOIN submissions s ON s.assignment_id = a.assignment_id
     LEFT JOIN evaluations e ON e.submission_id = s.submission_id
     WHERE a.instructor_id = $1
     GROUP BY a.assignment_id, a.title, a.description, a.language, a.due_date, a.created_at
     ORDER BY a.created_at DESC`,
    [instructorId],
  );

  return res.json({ assignments: result.rows });
}

async function getRecentSubmissions(req, res) {
  const instructorId = Number(req.query.instructorId);
  if (!instructorId) {
    return res.status(400).json({ error: "instructorId is required" });
  }

  const result = await pool.query(
    `SELECT
       s.submission_id AS id,
       u.full_name AS student,
       a.title AS assignment,
       e.total_score AS grade,
       s.status
     FROM submissions s
     JOIN assignments a ON a.assignment_id = s.assignment_id
     JOIN users u ON u.user_id = s.student_id
     LEFT JOIN evaluations e ON e.submission_id = s.submission_id
     WHERE a.instructor_id = $1
     ORDER BY s.submitted_at DESC
     LIMIT 10`,
    [instructorId],
  );

  return res.json({
    submissions: result.rows.map((row) => ({
      ...row,
      status: normalizeSubmissionStatus(row.status),
    })),
  });
}

async function getActiveStudents(_req, res) {
  const result = await pool.query(
    `SELECT COUNT(DISTINCT student_id)::int AS total
     FROM submissions
     WHERE submitted_at >= NOW() - INTERVAL '30 days'`,
  );
  return res.json({ total: result.rows[0].total || 0 });
}

async function getAssignmentGrades(req, res) {
  const assignmentId = Number(req.query.assignmentId);
  if (!assignmentId) {
    return res.status(400).json({ error: "assignmentId is required" });
  }

  const result = await pool.query(
    `SELECT DISTINCT ON (u.user_id)
       u.user_id AS "studentId",
       u.full_name AS "studentName",
       s.submission_id AS "submissionId",
       s.status,
       CASE
         WHEN s.status = 'Evaluated' THEN true
         WHEN f.feedback_id IS NOT NULL AND COALESCE(f.feedback_text, '') <> '' THEN true
         ELSE false
       END AS "hasReport"
     FROM submissions s
     JOIN users u ON u.user_id = s.student_id
     LEFT JOIN feedback f ON f.submission_id = s.submission_id
     WHERE s.assignment_id = $1
     ORDER BY u.user_id, s.submitted_at DESC`,
    [assignmentId],
  );

  return res.json({
    grades: result.rows.map((row) => ({
      ...row,
      status: normalizeSubmissionStatus(row.status),
    })),
  });
}

async function createAssignment(req, res) {
  const {
    instructor_id,
    title,
    description,
    language,
    due_date,
    correctness_weight,
    style_weight,
    readability_weight,
    efficiency_weight,
  } = req.body;

  const instructorId = Number(instructor_id);
  if (!instructorId || !title || !language) {
    return res.status(400).json({ error: "instructor_id, title, and language are required" });
  }

  const w = {
    correctness: Number(correctness_weight || 40),
    style: Number(style_weight || 25),
    efficiency: Number(efficiency_weight || 15),
    readability: Number(readability_weight || 20),
  };
  const allFinite = Object.values(w).every((v) => Number.isFinite(v) && v >= 0);
  if (!allFinite) {
    return res.status(400).json({ error: "All rubric weights must be non-negative numbers" });
  }
  const sum = w.correctness + w.style + w.efficiency + w.readability;
  if (Math.abs(sum - 100) > 0.001) {
    return res.status(400).json({ error: "Rubric weights must sum to 100" });
  }

  const rubricResult = await pool.query(
    `INSERT INTO rubrics (
       instructor_id, correctness_weight, style_weight, efficiency_weight, readability_weight, total_weight
     ) VALUES ($1, $2, $3, $4, $5, 100)
     RETURNING rubric_id`,
    [
      instructorId,
      w.correctness,
      w.style,
      w.efficiency,
      w.readability,
    ],
  );

  const rubricId = rubricResult.rows[0].rubric_id;
  const assignmentResult = await pool.query(
    `INSERT INTO assignments (instructor_id, title, description, language, due_date, rubric_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING assignment_id, title, language, due_date`,
    [instructorId, title, description || null, language, due_date || null, rubricId],
  );
  const assignment = assignmentResult.rows[0];

  if (req.file?.path) {
    await pool.query(
      `INSERT INTO assignment_documents (assignment_id, file_path)
       VALUES ($1, $2)
       ON CONFLICT (assignment_id)
       DO UPDATE SET file_path = EXCLUDED.file_path, uploaded_at = NOW()`,
      [assignment.assignment_id, req.file.path],
    );
  }

  return res.status(201).json({
    success: true,
    assignment,
    pdfUploaded: Boolean(req.file),
  });
}

async function uploadAssignmentPdf(req, res) {
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) {
    return res.status(400).json({ error: "Invalid assignment id" });
  }
  if (!req.file?.path) {
    return res.status(400).json({ error: "PDF file is required" });
  }

  const exists = await pool.query("SELECT assignment_id FROM assignments WHERE assignment_id = $1", [assignmentId]);
  if (!exists.rows.length) {
    return res.status(404).json({ error: "Assignment not found" });
  }

  await pool.query(
    `INSERT INTO assignment_documents (assignment_id, file_path)
     VALUES ($1, $2)
     ON CONFLICT (assignment_id)
     DO UPDATE SET file_path = EXCLUDED.file_path, uploaded_at = NOW()`,
    [assignmentId, req.file.path],
  );

  return res.json({ success: true, assignment_id: assignmentId });
}

async function updateAssignmentRubric(req, res) {
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) {
    return res.status(400).json({ error: "Invalid assignment id" });
  }

  const {
    correctness_weight,
    style_weight,
    efficiency_weight,
    readability_weight,
  } = req.body || {};

  const weights = {
    correctness: Number(correctness_weight),
    style: Number(style_weight),
    efficiency: Number(efficiency_weight),
    readability: Number(readability_weight),
  };

  const allFinite = Object.values(weights).every((v) => Number.isFinite(v) && v >= 0);
  if (!allFinite) {
    return res.status(400).json({ error: "All rubric weights must be non-negative numbers" });
  }

  const sum = weights.correctness + weights.style + weights.efficiency + weights.readability;
  if (Math.abs(sum - 100) > 0.001) {
    return res.status(400).json({ error: "Rubric weights must sum to 100" });
  }

  const assignmentResult = await pool.query(
    "SELECT rubric_id FROM assignments WHERE assignment_id = $1",
    [assignmentId],
  );
  if (!assignmentResult.rows.length || !assignmentResult.rows[0].rubric_id) {
    return res.status(404).json({ error: "Rubric not found for this assignment" });
  }

  const rubricId = assignmentResult.rows[0].rubric_id;
  const updated = await pool.query(
    `UPDATE rubrics
     SET correctness_weight = $1,
         style_weight = $2,
         efficiency_weight = $3,
         readability_weight = $4,
         total_weight = $5
     WHERE rubric_id = $6
     RETURNING rubric_id, correctness_weight, style_weight, efficiency_weight, readability_weight, total_weight`,
    [weights.correctness, weights.style, weights.efficiency, weights.readability, sum, rubricId],
  );

  return res.json({ success: true, rubric: updated.rows[0] });
}

module.exports = {
  getDashboardAssignments,
  getRecentSubmissions,
  getActiveStudents,
  getAssignmentGrades,
  createAssignment,
  uploadAssignmentPdf,
  updateAssignmentRubric,
};
