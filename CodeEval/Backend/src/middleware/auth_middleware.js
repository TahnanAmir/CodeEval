const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

async function authenticateJWT(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const session = await pool.query(
      "SELECT session_id, is_active, expires_at FROM user_sessions WHERE token = $1 LIMIT 1",
      [token],
    );

    if (session.rows.length > 0) {
      const row = session.rows[0];
      if (!row.is_active || new Date(row.expires_at).getTime() <= Date.now()) {
        return res.status(401).json({ success: false, message: "Session expired or logged out" });
      }
    } else {
      // Backfill missing session rows for already-issued valid JWTs.
      const expiresAt = payload.exp
        ? new Date(payload.exp * 1000)
        : new Date(Date.now() + 60 * 60 * 1000);
      await pool.query(
        "INSERT INTO user_sessions (user_id, token, expires_at, is_active) VALUES ($1, $2, $3, true)",
        [payload.user_id, token, expiresAt],
      );
    }

    req.user = payload;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid auth token" });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }
    return next();
  };
}

module.exports = { authenticateJWT, requireRole };
