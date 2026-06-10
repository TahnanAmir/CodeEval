const express = require("express");
const {
  uploadSubmission,
  getMySubmissions,
  getSubmissionStats,
  getAssignments,
  getAssignmentDetails,
  getAssignmentPdf,
} = require("../controllers/submission_controller");
const { authenticateJWT } = require("../middleware/auth_middleware");
const { upload } = require("../middleware/upload_middleware");

const router = express.Router();

router.post("/", authenticateJWT, upload.array("code_files", 20), uploadSubmission);
router.get("/my", authenticateJWT, getMySubmissions);
router.get("/stats", authenticateJWT, getSubmissionStats);
router.get("/assignments", authenticateJWT, getAssignments);
router.get("/assignments/:assignmentId", authenticateJWT, getAssignmentDetails);
router.get("/assignments/:assignmentId/pdf", authenticateJWT, getAssignmentPdf);

module.exports = router;
