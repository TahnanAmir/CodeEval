const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = new Set([".py", ".cpp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${baseName}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return cb(new Error("Only .py and .cpp files are allowed"));
    }
    return cb(null, true);
  },
});

module.exports = { upload };
