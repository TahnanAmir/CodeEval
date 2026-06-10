const express = require("express");
const { getSubmissionFeedback } = require("../controllers/feedback_controller");
const { authenticateJWT } = require("../middleware/auth_middleware");

const router = express.Router();

router.get("/:submissionId", authenticateJWT, getSubmissionFeedback);

module.exports = router;
