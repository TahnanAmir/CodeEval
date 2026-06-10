# Autograder AI

Automated test generation and execution for programming assignments using LLM agents.

## Setup

### 1. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your API key:
```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL_NAME=gpt-4o-mini
```

### 2. Local Setup

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows

# Install dependencies (Not now already did)
pip install poetry
poetry install

# Run
python3 main.py --assignment path/to/assignment.pdf --submission path/to/submission/
```

### 3. Docker Setup

```bash
# Prepare input files
mkdir -p input/submission
cp assignment.pdf input/
cp -r submission/* input/submission/

# Build and run
docker-compose build
docker-compose up
```

## Usage

The autograder:
1. Extracts questions from assignment PDF
2. Generates test cases for each question
3. Executes tests using LLM agent with ShellTool
4. Provides detailed pass/fail report with reasoning

### Input Format

- **Assignment**: PDF with questions labeled as Q1, Q2, etc.
- **Submissions**: Directory with files named `q_1.py`, `q_2.py`, etc.
- **Code**: Should read from stdin and print to stdout

### Example

```bash
python3 main.py \
  --assignment ~/Downloads/assignment.pdf \
  --submission ~/Downloads/submission/
```