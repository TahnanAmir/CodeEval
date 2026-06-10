const axios = require("axios");
const path = require("path");
const { pool } = require("../config/db");

async function persistFeedback(submissionId, feedbackText, generatedBy) {
  const updated = await pool.query(
    `UPDATE feedback
     SET feedback_text = $1, generated_by = $2, created_at = NOW()
     WHERE submission_id = $3`,
    [feedbackText, generatedBy, submissionId],
  );

  if (updated.rowCount > 0) {
    return;
  }

  await pool.query(
    `INSERT INTO feedback (submission_id, feedback_text, generated_by)
     VALUES ($1, $2, $3)`,
    [submissionId, feedbackText, generatedBy],
  );
}

async function instructorOwnsSubmission(instructorId, submissionId) {
  const result = await pool.query(
    `SELECT 1
     FROM submissions s
     INNER JOIN assignments a ON a.assignment_id = s.assignment_id
     WHERE s.submission_id = $1 AND a.instructor_id = $2`,
    [submissionId, instructorId],
  );
  return result.rows.length > 0;
}

/**
 * Runs the LangGraph evaluation pipeline for one submission.
 * @returns {Promise<{ submissionId: number, success: boolean, error?: string }>}
 */
async function triggerEvaluationForSubmission(submissionId) {
  const id = Number(submissionId);
  if (!Number.isFinite(id) || id <= 0) {
    return { submissionId: id, success: false, error: "Invalid submission id" };
  }

  try {
    const submissionResult = await pool.query(
      `SELECT
         s.submission_id,
         s.file_path,
         s.language,
         s.assignment_id,
         ad.file_path AS assignment_pdf_path,
         r.correctness_weight,
         r.style_weight,
         r.efficiency_weight,
         r.readability_weight
       FROM submissions s
       LEFT JOIN assignments a ON a.assignment_id = s.assignment_id
       LEFT JOIN rubrics r ON r.rubric_id = a.rubric_id
       LEFT JOIN assignment_documents ad ON ad.assignment_id = s.assignment_id
       WHERE s.submission_id = $1`,
      [id],
    );

    if (!submissionResult.rows.length) {
      throw new Error("Submission not found");
    }

    const submission = submissionResult.rows[0];
    let parsedFilePaths = [];
    try {
      parsedFilePaths = JSON.parse(submission.file_path);
      if (!Array.isArray(parsedFilePaths)) parsedFilePaths = [];
    } catch (_error) {
      parsedFilePaths = [];
    }
    const rawFilePaths = parsedFilePaths.length ? parsedFilePaths : [submission.file_path];
    const filePaths = rawFilePaths.map((p) => path.resolve(String(p)));
    const assignmentPdfPath = submission.assignment_pdf_path
      ? path.resolve(String(submission.assignment_pdf_path))
      : null;
    const serviceBaseURL = process.env.LANGGRAPH_SERVICE_URL || "http://localhost:8000";
    const endpoint = `${serviceBaseURL}/evaluate`;
    const rubric = {
      correctness: Number(submission.correctness_weight ?? 40),
      style: Number(submission.style_weight ?? 20),
      efficiency: Number(submission.efficiency_weight ?? 20),
      readability: Number(submission.readability_weight ?? 20),
    };

    let serviceData = {};
    let evaluationSucceeded = false;
    try {
      const response = await axios.post(endpoint, {
        submission_id: submission.submission_id,
        assignment_id: submission.assignment_id,
        assignment_pdf_path: assignmentPdfPath,
        file_path: filePaths[0],
        file_paths: filePaths,
        language: submission.language,
        rubric,
      });
      serviceData = response.data || {};
      evaluationSucceeded = true;
    } catch (serviceError) {
      serviceData = {
        feedback_text: `Evaluation service unavailable. ${serviceError?.message || ""}`.trim(),
      };
    }

    const fullReportText =
      serviceData.feedback_text ||
      serviceData.report ||
      serviceData.feedback ||
      "No evaluation report was returned.";

    await persistFeedback(submission.submission_id, fullReportText, "AI");

    await pool.query(
      "UPDATE submissions SET status = $1 WHERE submission_id = $2",
      [evaluationSucceeded ? "Evaluated" : "Error", submission.submission_id],
    );

    return { submissionId: id, success: evaluationSucceeded };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Evaluation pipeline failed:", error);

    try {
      await persistFeedback(id, `Evaluation pipeline error: ${error?.message || "Unknown error"}`, "AI");
    } catch (persistErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to persist feedback row:", persistErr);
    }

    try {
      await pool.query("UPDATE submissions SET status = 'Error' WHERE submission_id = $1", [id]);
    } catch (statusErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to set submission status Error:", statusErr);
    }

    return { submissionId: id, success: false, error: error?.message || "Unknown error" };
  }
}

async function triggerEvaluation(req, res) {
  const submissionId = Number(req.params.submissionId);
  if (!submissionId) {
    return res.status(400).json({ success: false, message: "Invalid submission id" });
  }

  const instructorId = Number(req.user.user_id);
  if (!(await instructorOwnsSubmission(instructorId, submissionId))) {
    return res.status(403).json({ success: false, message: "You cannot evaluate this submission" });
  }

  const result = await triggerEvaluationForSubmission(submissionId);
  return res.json({
    success: true,
    submissionId,
    evaluated: result.success,
    message: result.success ? "Evaluation completed" : "Evaluation finished with errors",
  });
}

async function triggerBatchEvaluation(req, res) {
  const instructorId = Number(req.user.user_id);
  const raw = req.body?.submissionIds ?? req.body?.submission_ids;
  const ids = (Array.isArray(raw) ? raw : [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  const uniqueIds = [...new Set(ids)];

  if (!uniqueIds.length) {
    return res.status(400).json({
      success: false,
      message: "Provide a non-empty submissionIds array",
    });
  }

  const allowed = await pool.query(
    `SELECT s.submission_id
     FROM submissions s
     INNER JOIN assignments a ON a.assignment_id = s.assignment_id
     WHERE s.submission_id = ANY($1::int[]) AND a.instructor_id = $2`,
    [uniqueIds, instructorId],
  );
  const allowedSet = new Set(allowed.rows.map((row) => Number(row.submission_id)));
  const unauthorized = uniqueIds.filter((sid) => !allowedSet.has(sid));
  if (unauthorized.length) {
    return res.status(403).json({
      success: false,
      message: "Some submissions are not part of your assignments",
      unauthorizedSubmissionIds: unauthorized,
    });
  }

  const maxConcurrent = Math.min(
    Math.max(1, Number.parseInt(process.env.EVAL_BATCH_CONCURRENCY, 10) || 3),
    uniqueIds.length,
  );

  const results = [];
  for (let i = 0; i < uniqueIds.length; i += maxConcurrent) {
    const chunk = uniqueIds.slice(i, i + maxConcurrent);
    const chunkResults = await Promise.all(chunk.map((sid) => triggerEvaluationForSubmission(sid)));
    results.push(...chunkResults);
  }

  const evaluated = results.filter((r) => r.success).length;
  return res.json({
    success: true,
    processed: uniqueIds.length,
    evaluated,
    failed: uniqueIds.length - evaluated,
    results,
  });
}

module.exports = { triggerEvaluation, triggerBatchEvaluation, triggerEvaluationForSubmission };
