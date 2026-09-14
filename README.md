<div align="center">

# CodeEval

**AI-powered coding evaluation platform for Python & C++ assignments**

End-to-end assignment management, instructor-triggered grading, and intelligent feedback — built on the PERN stack with a LangGraph grading engine.

[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-LangGraph-3776AB?logo=python&logoColor=white)](https://www.langchain.com/langgraph)
[![OpenAI](https://img.shields.io/badge/OpenAI-LLM-412991?logo=openai&logoColor=white)](https://openai.com/)

</div>

---

## Overview

**CodeEval** is a full-stack platform that automates programming assignment evaluation for educators and students. Instructors create assignments with custom rubrics and assignment PDFs. Students submit Python or C++ solutions and grading is triggered on demand — producing automated scores, detailed performance reports and AI-generated feedback.

The system is role-aware, with dedicated workflows for **students**, **instructors**, and **admins**, and a three-stage LangGraph pipeline that generates test cases, executes them against student code, and evaluates results against instructor-defined rubrics.

---

## Features

### For Students
- Browse available assignments and view assignment PDFs
- Upload multi-file submissions (`.py`, `.cpp`) per assignment
- Track submission status (`pending` → `Evaluated` / `Error`)
- View detailed AI feedback reports with per-question analysis

### For Instructors
- Create assignments with title, description, language, and due date
- Upload assignment PDFs (questions labeled Q1, Q2, …)
- Configure weighted rubrics — correctness, style, efficiency, readability
- Review recent submissions and grade distributions
- **Trigger grading** for individual submissions or batches
- Monitor active students and assignment performance

### For Admins
- Platform-wide user statistics
- Create, list, and manage user accounts (student / instructor / admin)
- Activate or deactivate user accounts

### AI Grading Engine
- Parses assignment PDFs and maps submissions to questions (`q_1.py`, `q_2.cpp`, …)
- Generates context-aware test cases via LangGraph agents
- Executes tests in a sandboxed environment with pass/fail reporting
- Applies rubric-weighted scoring and produces narrative feedback

---

## Architecture

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Router |
| **Backend** | Node.js, Express 5, JWT, bcrypt, Multer, pg |
| **Database** | PostgreSQL |
| **AI Service** | FastAPI, LangGraph, LangChain, OpenAI (optional Ollama) |
| **Languages** | Python 3.13+, C++ (g++), Python submissions |

---

## Project Structure

```
CodeEval/
├── CodeEval/
│   ├── frontend/              # React SPA (port 8080)
│   │   └── src/
│   │       ├── pages/         # Landing, dashboards, feedback, assignments
│   │       ├── components/    # Navigation, protected routes, UI kit
│   │       └── lib/           # API client & utilities
│   │
│   ├── Backend/               # Express REST API (port 3001)
│   │   └── src/
│   │       ├── controllers/   # Auth, submissions, evaluations, instructor, admin
│   │       ├── routes/        # Route definitions
│   │       ├── middleware/    # JWT auth, file upload, error handling
│   │       └── config/        # DB pool & schema initialization
│   │
│   └── langgraph-service/     # FastAPI grading microservice (port 8000)
│       └── app.py             # Wraps autograder-ai with rubric support
│
└── autograder-ai/             # LangGraph grading engine (Python)
    └── src/autograder_ai/
        ├── engine.py          # Orchestrates the 3-stage pipeline
        ├── workflows/         # Test generation, execution, evaluation graphs
        ├── core/              # PDF & submission pre-processors
        └── clients/           # OpenAI & Ollama LLM clients
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Python | 3.13+ |
| Poetry | Latest (for autograder-ai) |
| g++ | For C++ submissions |
| OpenAI API key | Required for AI grading |

### 1. Clone the repository

```bash
git clone https://github.com/TahnanAmir/CodeEval.git
cd CodeEval
```

### 2. Set up PostgreSQL

Create a database for the application:

```bash
createdb evalbright
```

The backend auto-initializes tables on first startup (`users`, `assignments`, `rubrics`, `submissions`, `feedback`, `evaluations`, `user_sessions`).

### 3. Configure environment variables

<details>
<summary><strong>Backend</strong> — <code>CodeEval/Backend/.env</code></summary>

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/evalbright
# Or individual vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# Auth
JWT_SECRET=your_secure_random_secret
JWT_EXPIRES_IN=7d

# Server
PORT=3001
CORS_ORIGINS=http://localhost:8080,http://localhost:5173

# AI integration
LANGGRAPH_SERVICE_URL=http://localhost:8000
EVAL_BATCH_CONCURRENCY=3

# Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

</details>

<details>
<summary><strong>Frontend</strong> — <code>CodeEval/frontend/.env</code> (optional)</summary>

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

</details>

<details>
<summary><strong>Autograder AI</strong> — <code>autograder-ai/.env</code></summary>

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL_NAME=gpt-4o-mini

# Optional — local LLM fallback
OLLAMA_MODEL_NAME=llama3.1:8b
```

</details>

### 4. Install and run services

Open **four terminals** and start each service:

**Terminal 1 — Backend**
```bash
cd CodeEval/Backend
npm install
npm run dev
# → http://localhost:3001
```

**Terminal 2 — Frontend**
```bash
cd CodeEval/frontend
npm install
npm run dev
# → http://localhost:8080
```

**Terminal 3 — Autograder AI (dependencies)**
```bash
cd autograder-ai
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install poetry
poetry install
```

**Terminal 4 — LangGraph Service**
```bash
cd CodeEval/langgraph-service
source ../../autograder-ai/.venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
# → http://localhost:8000
```

### 5. Verify health checks

```bash
curl http://localhost:3001/health    # Backend
curl http://localhost:8000/health    # LangGraph service
```

Open **http://localhost:8080** in your browser to use the application.

---

## Grading Pipeline

When an instructor triggers evaluation, the system runs a **three-stage LangGraph pipeline**:

```
Assignment PDF + Student Code
         │
         ▼
┌─────────────────────────┐
│  1. Test Case Generation │  Analyze questions & code → generate test inputs/outputs
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  2. Test Execution       │  Run tests via LLM agent + shell execution
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  3. Rubric Evaluation    │  Score correctness, style, efficiency, readability
└────────────┬────────────┘
             ▼
    Scores + Detailed Feedback Report
```

**Submission format:** Files named `q_1.py`, `q_2.cpp`, etc., matching question IDs in the assignment PDF. Code should read from **stdin** and write to **stdout**.

**Rubric weights** (default): Correctness 40% · Style 20% · Efficiency 20% · Readability 20% — fully configurable per assignment.

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/auth/logout` | Invalidate session |

### Submissions *(JWT required)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/submissions` | Upload code files for an assignment |
| `GET` | `/api/submissions/my` | List current user's submissions |
| `GET` | `/api/submissions/assignments` | List available assignments |
| `GET` | `/api/submissions/assignments/:id/pdf` | Download assignment PDF |

### Evaluations *(Instructor only)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/evaluations/:submissionId/trigger` | Grade a single submission |
| `POST` | `/api/evaluations/batch/trigger` | Grade multiple submissions |

### Instructor
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/instructor/assignments/create` | Create assignment + upload PDF |
| `PUT` | `/instructor/assignments/:id/rubric` | Update rubric weights |
| `GET` | `/instructor/dashboard/assignments` | Dashboard assignment list |
| `GET` | `/instructor/dashboard/recent-submissions` | Recent student submissions |
| `GET` | `/instructor/dashboard/grades` | Grade distribution by assignment |

### Admin *(JWT required)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/stats` | Platform statistics |
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/add-user` | Create a user account |
| `PUT` | `/admin/update-user/:userId` | Update user details / status |

### LangGraph Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `POST` | `/evaluate` | Run full grading pipeline |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Accounts with roles: `student`, `instructor`, `admin` |
| `assignments` | Assignment metadata, language, due date |
| `assignment_documents` | Uploaded assignment PDF paths |
| `rubrics` | Weighted scoring criteria per assignment |
| `submissions` | Student code uploads and status |
| `feedback` | AI-generated feedback text |
| `evaluations` | Numeric scores per rubric dimension |
| `user_sessions` | Active JWT sessions |

---

## Typical Workflow

1. **Instructor** registers, creates an assignment, uploads a PDF, and sets rubric weights.
2. **Student** registers, browses assignments, and uploads `q_1.py`, `q_2.py`, … files.
3. **Instructor** reviews submissions on the dashboard and clicks **Evaluate** (single or batch).
4. Backend forwards the submission to the LangGraph service, which runs the autograder pipeline.
5. Scores and a detailed feedback report are stored in PostgreSQL.
6. **Student** opens the feedback report page to review results and AI commentary.

---

## Development

```bash
# Frontend lint
cd CodeEval/frontend && npm run lint

# Frontend production build
cd CodeEval/frontend && npm run build

# Run autograder standalone (without the web platform)
cd autograder-ai
python main.py --assignment path/to/assignment.pdf --submission path/to/submission/
```

---

## Tech Highlights

- **Role-based access control** with JWT sessions stored in PostgreSQL
- **Instructor-triggered grading** — evaluations run only when requested, not on every upload
- **Batch evaluation** with configurable concurrency (`EVAL_BATCH_CONCURRENCY`)
- **Rubric-aware scoring** passed through the entire LangGraph evaluation workflow
- **Multi-file submissions** staged into temp directories for the grading engine
- **Modern UI** with shadcn/ui components, responsive dashboards, and feedback report views
