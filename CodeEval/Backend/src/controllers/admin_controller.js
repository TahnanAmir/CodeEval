const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

async function getStats(_req, res) {
  const result = await pool.query("SELECT COUNT(*)::int AS total_users FROM users");
  return res.json({ totalUsers: String(result.rows[0].total_users || 0) });
}

async function listUsers(_req, res) {
  const result = await pool.query(
    `SELECT user_id, full_name, email, role, is_active, date_joined
     FROM users
     ORDER BY date_joined DESC`,
  );
  return res.json(result.rows);
}

async function addUser(req, res) {
  const { name, email, role } = req.body || {};
  if (!name || !email || !role) {
    return res.status(400).json({ message: "name, email, and role are required" });
  }

  const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) {
    return res.status(409).json({ message: "Email already exists" });
  }

  // Admin-created users get a temporary password (can be reset later)
  const tempPassword = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const created = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING user_id, full_name, email, role, is_active`,
    [name, email, passwordHash, role],
  );

  return res.status(201).json({ success: true, user: created.rows[0], tempPassword });
}

async function updateUser(req, res) {
  const userId = Number(req.params.userId);
  const { name, email, role, status } = req.body || {};
  if (!userId) return res.status(400).json({ message: "Invalid user id" });

  const isActive = status === "active";
  const updated = await pool.query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         is_active = $4
     WHERE user_id = $5
     RETURNING user_id, full_name, email, role, is_active`,
    [name || null, email || null, role || null, isActive, userId],
  );

  if (!updated.rows.length) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ success: true, user: updated.rows[0] });
}

module.exports = { getStats, listUsers, addUser, updateUser };
