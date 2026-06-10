const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/auth_router");
const submissionRouter = require("./routes/submission_router");
const evaluationRouter = require("./routes/evaluation_router");
const feedbackRouter = require("./routes/feedback_router");
const instructorRouter = require("./routes/instructor_router");
const adminRouter = require("./routes/admin_router");
const { errorHandler } = require("./middleware/error_middleware");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/submissions", submissionRouter);
app.use("/api/evaluations", evaluationRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/instructor", instructorRouter);
app.use("/admin", adminRouter);

app.use(errorHandler);

module.exports = app;
