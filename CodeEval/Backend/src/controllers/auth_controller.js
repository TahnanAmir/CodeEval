const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

function getJwtExpiresIn() {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return "1h";
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function getSessionExpiryDate() {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return new Date(Date.now() + 60 * 60 * 1000);
  if (/^\d+$/.test(raw)) return new Date(Date.now() + Number(raw) * 1000);
  if (raw.endsWith("h")) return new Date(Date.now() + Number(raw.slice(0, -1)) * 60 * 60 * 1000);
  if (raw.endsWith("m")) return new Date(Date.now() + Number(raw.slice(0, -1)) * 60 * 1000);
  if (raw.endsWith("d")) return new Date(Date.now() + Number(raw.slice(0, -1)) * 24 * 60 * 60 * 1000);
  return new Date(Date.now() + 60 * 60 * 1000);
}

function buildToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: getJwtExpiresIn() },
  );
}

async function register(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, full_name, email, role`,
    [name, email, passwordHash, role],
  );

  const user = created.rows[0];
  const token = buildToken(user);
  const expiresAt = getSessionExpiryDate();
  await pool.query(
    "INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [user.user_id, token, expiresAt],
  );

  return res.status(201).json({ success: true, token, user });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const result = await pool.query(
    "SELECT user_id, full_name, email, role, password_hash FROM users WHERE email = $1",
    [email],
  );

  if (!result.rows.length) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const userRecord = result.rows[0];
  const isMatch = await bcrypt.compare(password, userRecord.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const user = {
    user_id: userRecord.user_id,
    full_name: userRecord.full_name,
    email: userRecord.email,
    role: userRecord.role,
  };

  const token = buildToken(user);
  const expiresAt = getSessionExpiryDate();
  await pool.query(
    "INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [user.user_id, token, expiresAt],
  );

  return res.json({ success: true, token, user });
}

async function logout(req, res) {
  const token = req.token;
  await pool.query("UPDATE user_sessions SET is_active = false WHERE token = $1", [token]);
  return res.json({ success: true, message: "Logged out successfully" });
}

module.exports = { register, login, logout };
