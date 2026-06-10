const { pool } = require("./db");

const schemaSQL = `
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
  date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS rubrics (
  rubric_id SERIAL PRIMARY KEY,
  instructor_id INTEGER REFERENCES users(user_id),
  correctness_weight NUMERIC(5,2) DEFAULT 40,
  style_weight NUMERIC(5,2) DEFAULT 20,
  efficiency_weight NUMERIC(5,2) DEFAULT 20,
  readability_weight NUMERIC(5,2) DEFAULT 20,
  total_weight NUMERIC(5,2) DEFAULT 100
);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id SERIAL PRIMARY KEY,
  instructor_id INTEGER REFERENCES users(user_id),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  language VARCHAR(30) NOT NULL,
  due_date TIMESTAMP,
  rubric_id INTEGER REFERENCES rubrics(rubric_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignment_documents (
  document_id SERIAL PRIMARY KEY,
  assignment_id INTEGER UNIQUE REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  submission_id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(assignment_id),
  student_id INTEGER REFERENCES users(user_id),
  file_path TEXT NOT NULL,
  language VARCHAR(30) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS feedback (
  feedback_id SERIAL PRIMARY KEY,
  submission_id INTEGER UNIQUE REFERENCES submissions(submission_id) ON DELETE CASCADE,
  feedback_text TEXT,
  generated_by VARCHAR(20) DEFAULT 'ai',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluations (
  evaluation_id SERIAL PRIMARY KEY,
  submission_id INTEGER UNIQUE REFERENCES submissions(submission_id) ON DELETE CASCADE,
  evaluator_type VARCHAR(20) DEFAULT 'ai',
  correctness_score NUMERIC(5,2),
  style_score NUMERIC(5,2),
  efficiency_score NUMERIC(5,2),
  readability_score NUMERIC(5,2),
  total_score NUMERIC(5,2),
  feedback_id INTEGER REFERENCES feedback(feedback_id),
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function initSchema() {
  await pool.query(schemaSQL);
}

module.exports = { initSchema };
