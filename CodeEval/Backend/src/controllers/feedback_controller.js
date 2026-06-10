const { pool } = require("../config/db");

async function getSubmissionFeedback(req, res) {
  const submissionId = Number(req.params.submissionId);
  if (!submissionId) {
    return res.status(400).json({ success: false, message: "Invalid submission id" });
  }

  const result = await pool.query(
    `SELECT
      s.submission_id,
      COALESCE(a.title, 'Assignment') AS assignment,
      s.language,
      s.status AS submission_status,
      TO_CHAR(s.submitted_at, 'YYYY-MM-DD HH24:MI') AS submitted_date,
      TO_CHAR(COALESCE(e.evaluated_at, f.created_at), 'YYYY-MM-DD HH24:MI') AS evaluated_date,
      e.correctness_score,
      e.style_score,
      e.efficiency_score,
      e.readability_score,
      e.total_score,
      f.feedback_text
    FROM submissions s
    LEFT JOIN assignments a ON a.assignment_id = s.assignment_id
    LEFT JOIN evaluations e ON e.submission_id = s.submission_id
    LEFT JOIN feedback f ON f.submission_id = s.submission_id
    WHERE s.submission_id = $1`,
    [submissionId],
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: "Submission not found" });
  }

  const row = result.rows[0];
  const normalizedStatus =
    row.submission_status === "Evaluated"
      ? "completed"
      : row.submission_status === "Pending"
        ? "pending"
        : row.submission_status === "Error"
          ? "failed"
          : "pending";

  const fallbackReportText =
    normalizedStatus === "failed"
      ? "Evaluation failed before results could be persisted. Please retry submission or trigger evaluation again."
      : "Evaluation has been queued. Please check again shortly.";

  return res.json({
    success: true,
    submissionId: row.submission_id,
    assignment: row.assignment,
    language: row.language,
    submittedDate: row.submitted_date,
    evaluationDate: row.evaluated_date,
    status: normalizedStatus,
    overallGrade: Number(row.total_score ?? 0),
    reportText: row.feedback_text || fallbackReportText,
    codeHighlights: [
      {
        type: Number(row.total_score ?? 0) >= 70 ? "success" : "warning",
        lineNumber: 1,
        message: row.feedback_text || "Evaluation has been queued. Please check again shortly.",
      },
    ],
    categories: [
      {
        name: "Correctness",
        weight: 40,
        score: Number(row.correctness_score ?? 0),
        feedback: "Checks correctness against expected behavior.",
      },
      {
        name: "Style",
        weight: 20,
        score: Number(row.style_score ?? 0),
        feedback: "Looks for readability and clean coding style.",
      },
      {
        name: "Efficiency",
        weight: 20,
        score: Number(row.efficiency_score ?? 0),
        feedback: "Estimates algorithmic and implementation efficiency.",
      },
      {
        name: "Readability",
        weight: 20,
        score: Number(row.readability_score ?? 0),
        feedback: "Measures structure, naming, and maintainability.",
      },
    ],
  });
}

module.exports = { getSubmissionFeedback };
