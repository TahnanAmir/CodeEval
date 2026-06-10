const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const {
  getDashboardAssignments,
  getRecentSubmissions,
  getActiveStudents,
  getAssignmentGrades,
  createAssignment,
  uploadAssignmentPdf,
  updateAssignmentRubric,
} = require("../controllers/instructor_controller");

const router = express.Router();

const assignmentsUploadDir = path.join(__dirname, "../../uploads/assignments");
if (!fs.existsSync(assignmentsUploadDir)) {
  fs.mkdirSync(assignmentsUploadDir, { recursive: true });
}

const uploadPdf = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, assignmentsUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
      const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      cb(null, fileName.endsWith(ext) ? fileName : `${fileName}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Only PDF files are allowed"));
    return cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.get("/dashboard/assignments", getDashboardAssignments);
router.get("/dashboard/recent-submissions", getRecentSubmissions);
router.get("/dashboard/grades", getAssignmentGrades);
router.get("/active-students", getActiveStudents);
router.post("/assignments/create", uploadPdf.single("pdf"), createAssignment);
router.post("/assignments/:assignmentId/pdf", uploadPdf.single("pdf"), uploadAssignmentPdf);
router.put("/assignments/:assignmentId/rubric", express.json(), updateAssignmentRubric);

module.exports = router;
