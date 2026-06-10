function errorHandler(err, _req, res, _next) {
  const message = err.message || "Unexpected server error";
  return res.status(400).json({ success: false, message });
}

module.exports = { errorHandler };
