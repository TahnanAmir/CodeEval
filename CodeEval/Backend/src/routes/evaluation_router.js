const express = require("express");
const { triggerEvaluation, triggerBatchEvaluation } = require("../controllers/evaluation_controller");
const { authenticateJWT, requireRole } = require("../middleware/auth_middleware");

const router = express.Router();

router.post("/batch/trigger", authenticateJWT, requireRole("instructor"), triggerBatchEvaluation);
router.post("/:submissionId/trigger", authenticateJWT, requireRole("instructor"), triggerEvaluation);

module.exports = router;
