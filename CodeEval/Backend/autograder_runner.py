import argparse
import contextlib
import io
import json
import os
import sys
from pathlib import Path


def _safe_mean(values, default=0.0):
    values = [v for v in values if v is not None]
    if not values:
        return float(default)
    return sum(values) / len(values)


def _percent_from_1_to_10(value):
    try:
        return float(value) / 10.0 * 100.0
    except Exception:
        return 70.0


def _compute_language_label(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return {
        ".py": "Python",
        ".js": "JavaScript",
        ".ts": "TypeScript",
        ".java": "Java",
        ".cpp": "C++",
        ".c": "C",
        ".txt": "Text",
        ".hpp": "C++",
        ".h": "C",
    }.get(suffix, "Code")


def _lang_label_from_submission_dir(submission_dir: Path) -> str:
    for f in submission_dir.iterdir():
        if f.is_file() and f.name.lower().startswith("q_"):
            return _compute_language_label(f.name)
    return "Code"


def main():
    parser = argparse.ArgumentParser(description="Run autograder-ai evaluation and return JSON.")
    parser.add_argument("--assignment-path", required=True, type=str)
    parser.add_argument("--submission-file", required=False, type=str, default=None)
    parser.add_argument("--submission-dir", required=True, type=str)
    parser.add_argument(
        "--prepackaged-submission-dir",
        required=False,
        type=str,
        default=None,
        help="If provided, this directory is expected to contain q_* files and will be copied into submission-dir.",
    )
    args = parser.parse_args()

    # Resolve repo locations from this script path.
    this_file = Path(__file__).resolve()
    workspace_root = this_file.parents[2]
    autograder_root = workspace_root / "autograder-ai"
    autograder_src = autograder_root / "src"

    sys.path.insert(0, str(autograder_src))

    from dotenv import load_dotenv

    # Load OPENAI_API_KEY and model config for autograder-ai.
    load_dotenv(str(autograder_root / ".env"))

    from autograder_ai.core.pre_processors.assignment import AssignmentPreProcessor
    from autograder_ai.engine import EvaluationEngine

    assignment_path = Path(args.assignment_path).resolve()
    submission_file = Path(args.submission_file).resolve() if args.submission_file else None
    submission_dir = Path(args.submission_dir).resolve()
    prepackaged_submission_dir = (
        Path(args.prepackaged_submission_dir).resolve() if args.prepackaged_submission_dir else None
    )

    submission_dir.mkdir(parents=True, exist_ok=True)

    # Extract question ids (q_1, q_2, ...) from assignment PDF.
    questions = AssignmentPreProcessor(str(assignment_path)).run()
    question_ids = list(questions.keys())

    # If we have prepackaged q_* files, use them 
    # Only duplicate the UI's single uploaded file when no prepackaged directory exists.
    if prepackaged_submission_dir:
        if not prepackaged_submission_dir.exists() or not prepackaged_submission_dir.is_dir():
            raise NotADirectoryError(f"prepackaged submission dir not found: {prepackaged_submission_dir}")

        for file in prepackaged_submission_dir.iterdir():
            if file.is_file() and file.name.lower().startswith("q_"):
                dest = submission_dir / file.name
                dest.write_bytes(file.read_bytes())
    else:
        if not submission_file:
            raise ValueError("Missing --submission-file (and no --prepackaged-submission-dir provided).")

        code_text = submission_file.read_text(encoding="utf-8", errors="ignore")
        ext = submission_file.suffix or ".txt"
        for qid in question_ids:
            out_path = submission_dir / f"{qid}{ext}"
            out_path.write_text(code_text, encoding="utf-8", errors="ignore")

    # Run evaluation but suppress stdout/stderr noise from the workflow.
    engine = EvaluationEngine(assignment_path, submission_dir)
    buffer = io.StringIO()
    suppress_output = os.getenv("AUTOGRADER_RUNNER_SUPPRESS_OUTPUT", "1") != "0"
    debug_tail = ""
    try:
        if suppress_output:
            with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
                results = engine.run()
            debug_tail = buffer.getvalue()[-4000:]
        else:
            results = engine.run()
    except Exception as e:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "grade": None,
                    "categories": [],
                    "error": str(e),
                    "autograder_stderr_stdout": debug_tail or buffer.getvalue()[-4000:],
                }
            )
        )
        return

    # Aggregate results into the frontend categories.
    weights = {"correctness": 40, "code_style": 25, "readability": 20, "efficiency": 15}

    correctness_statuses = []
    correctness_scores = []
    code_style_scores = []
    readability_scores = []
    efficiency_scores = []
    correctness_feedbacks = []
    code_quality_feedbacks = []
    overall_feedbacks = []

    for question_id, qresult in results.items():
        evaluation = qresult.get("evaluation") or {}
        correctness = evaluation.get("correctness") or {}
        code_quality = evaluation.get("code_quality") or {}
        partial_credit = evaluation.get("partial_credit") or {}

        correctness_status = correctness.get("status")
        correctness_statuses.append(correctness_status)

        test_results = qresult.get("test_results") or []
        passed = sum(1 for tr in test_results if tr.get("passed"))
        total = len(test_results)
        efficiency = (passed / total * 100.0) if total else 0.0
        efficiency_scores.append(efficiency)

        # correctness: use partial_credit suggested_score (0..100) when available.
        suggested_score = partial_credit.get("suggested_score") if isinstance(partial_credit, dict) else None
        if suggested_score is None:
            correctness_conf = correctness.get("confidence") if correctness else 0.0
            suggested_score = float(correctness_conf) * 100.0
        correctness_scores.append(float(suggested_score))

        readability_val = code_quality.get("readability", 7)
        structure_val = code_quality.get("structure", 7)
        best_practices_val = code_quality.get("best_practices", 7)

        readability_scores.append(_percent_from_1_to_10(readability_val))
        code_style_scores.append(_percent_from_1_to_10((float(structure_val) + float(best_practices_val)) / 2.0))

        if correctness.get("explanation"):
            correctness_feedbacks.append(str(correctness.get("explanation")))
        if code_quality.get("comments"):
            code_quality_feedbacks.append(str(code_quality.get("comments")))
        if evaluation.get("feedback"):
            overall_feedbacks.append(str(evaluation.get("feedback")))

    if not correctness_scores:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "grade": None,
                    "categories": [],
                    "error": "No evaluation scores produced.",
                }
            )
        )
        return

    correctness_avg = _safe_mean(correctness_scores)
    code_style_avg = _safe_mean(code_style_scores)
    readability_avg = _safe_mean(readability_scores)
    efficiency_avg = _safe_mean(efficiency_scores)

    overall_grade = (
        correctness_avg * (weights["correctness"] / 100.0)
        + code_style_avg * (weights["code_style"] / 100.0)
        + readability_avg * (weights["readability"] / 100.0)
        + efficiency_avg * (weights["efficiency"] / 100.0)
    )
    overall_grade = round(overall_grade, 2)

    # If every question is marked incorrect, treat as "failed".
    is_failed = bool(correctness_statuses) and all(s == "incorrect" for s in correctness_statuses)

    correctness_feedback = (correctness_feedbacks[0] if correctness_feedbacks else "").strip()
    code_quality_feedback = (code_quality_feedbacks[0] if code_quality_feedbacks else "").strip()
    overall_feedback = (overall_feedbacks[0] if overall_feedbacks else "").strip()

    # If the correctness node failed to return strict JSON, autograder stores a technical
    # error message in `correctness.explanation`. For UI purposes, prefer the overall
    # feedback (human-friendly) instead of showing the parsing error.
    if not correctness_feedback or "LLM failure" in correctness_feedback:
        correctness_feedback = overall_feedback

    lang_label = (
        _compute_language_label(submission_file.name)
        if submission_file
        else _lang_label_from_submission_dir(submission_dir)
    )

    categories = [
        {
            "name": "Correctness",
            "score": round(correctness_avg, 0),
            "weight": weights["correctness"],
            "feedback": correctness_feedback or overall_feedback,
        },
        {
            "name": "Code Style",
            "score": round(code_style_avg, 0),
            "weight": weights["code_style"],
            "feedback": code_quality_feedback or overall_feedback,
        },
        {
            "name": "Readability",
            "score": round(readability_avg, 0),
            "weight": weights["readability"],
            "feedback": code_quality_feedback or overall_feedback,
        },
        {
            "name": "Efficiency",
            "score": round(efficiency_avg, 0),
            "weight": weights["efficiency"],
            "feedback": f"Overall pass rate: {round(efficiency_avg, 0)}%.",
        },
    ]

    print(
        json.dumps(
            {
                "status": "failed" if is_failed else "completed",
                "grade": overall_grade,
                "categories": categories,
                "language": lang_label,
                "overall_feedback": overall_feedback,
                "_debug": {
                    "model": os.getenv("OPENAI_MODEL_NAME"),
                    "api_key_set": bool(os.getenv("OPENAI_API_KEY")),
                    "stdout_stderr_tail": debug_tail,
                },
            }
        )
    )


if __name__ == "__main__":
    main()

