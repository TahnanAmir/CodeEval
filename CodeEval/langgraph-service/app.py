import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional, Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

# Import autograder-ai without modifying it.
REPO_ROOT = Path(__file__).resolve().parents[2]
AUTO_GRADER_SRC = REPO_ROOT / "autograder-ai" / "src"
if str(AUTO_GRADER_SRC) not in os.sys.path:
    os.sys.path.insert(0, str(AUTO_GRADER_SRC))

from autograder_ai.engine import EvaluationEngine  # noqa: E402
from autograder_ai.workflows.builders.evaluation import EvaluationBuilder  # noqa: E402


class EvaluateRequest(BaseModel):
    submission_id: int
    assignment_id: Optional[int] = None
    assignment_pdf_path: Optional[str] = None
    file_path: Optional[str] = None
    file_paths: Optional[List[str]] = None
    language: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None


app = FastAPI(title="EvalBright LangGraph Service")


class RubricAwareEvaluationEngine(EvaluationEngine):
    def __init__(self, assignment_path: Path, submission_path: Path, rubric: Optional[Dict[str, Any]] = None):
        super().__init__(assignment_path, submission_path)
        self.rubric = rubric or {}

    def _run_evaluation(self):
        builder = EvaluationBuilder(self.llm)
        workflow = builder.build()
        print(f"[rubric-debug] Rubric configured for evaluation run: {self.rubric}")

        for question_id, result in self.results.items():
            if "test_results" not in result:
                continue

            state = {
                "question_id": question_id,
                "question": result["question"],
                "code": result["code"],
                "test_results": result["test_results"],
                "rubric": self.rubric,
                "status": "processing",
            }
            print(f"[rubric-debug] Applying rubric to question {question_id}: {state['rubric']}")

            eval_result = workflow.invoke(state)
            self.results[question_id]["evaluation"] = eval_result


@app.get("/health")
def health():
    return {"success": True, "status": "ok"}


def _pick_assignment_pdf(req: EvaluateRequest) -> Path:
    if req.assignment_pdf_path:
        pdf = Path(req.assignment_pdf_path)
        if pdf.exists():
            return pdf
    raise HTTPException(status_code=400, detail="Missing or invalid assignment_pdf_path")


def _build_submission_path(req: EvaluateRequest) -> Path:
    paths = []
    if req.file_paths:
        paths = [Path(p) for p in req.file_paths]
    elif req.file_path:
        paths = [Path(req.file_path)]

    if not paths:
        raise HTTPException(status_code=400, detail="Missing file_path(s)")

    for p in paths:
        if not p.exists():
            raise HTTPException(status_code=400, detail=f"Submission file not found: {p}")

    # SubmissionPreProcessor requires a directory. Stage files into a temp dir when needed.
    if len(paths) == 1:
        p = paths[0]
        if p.is_dir():
            return p
        tmp_dir = Path(tempfile.mkdtemp(prefix=f"submission_{req.submission_id}_"))
        shutil.copy2(p, tmp_dir / p.name)
        return tmp_dir

    tmp_dir = Path(tempfile.mkdtemp(prefix=f"submission_{req.submission_id}_"))
    for p in paths:
        shutil.copy2(p, tmp_dir / p.name)
    return tmp_dir


def _extract_scores(results: Dict[str, Any]) -> Dict[str, float]:
    # Best-effort extraction from engine output.
    # If your evaluation workflow returns structured scoring, map it here.
    pass_rates = []
    readability = []
    structure = []
    best_practices = []
    totals = []
    feedback_texts = []

    for _qid, r in (results or {}).items():
        test_results = r.get("test_results") or []
        if test_results:
            passed = sum(1 for tr in test_results if tr.get("passed"))
            total = len(test_results)
            pass_rates.append((passed / total) * 100 if total else 0)

        evaluation = r.get("evaluation") or {}
        if isinstance(evaluation, dict):
            quality = evaluation.get("code_quality") or {}
            if isinstance(quality, dict):
                if quality.get("readability") is not None:
                    readability.append(float(quality["readability"]) * 10)
                if quality.get("structure") is not None:
                    structure.append(float(quality["structure"]) * 10)
                if quality.get("best_practices") is not None:
                    best_practices.append(float(quality["best_practices"]) * 10)

            final_score = evaluation.get("final_score") or {}
            if isinstance(final_score, dict) and final_score.get("total") is not None:
                try:
                    totals.append(float(final_score["total"]))
                except Exception:
                    pass

            fb = evaluation.get("feedback")
            if isinstance(fb, str) and fb.strip():
                feedback_texts.append(fb.strip())

    def avg(xs: List[float]) -> float:
        return sum(xs) / len(xs) if xs else 0.0

    correctness = avg(pass_rates)
    style = avg(best_practices)
    efficiency = avg(structure)
    read = avg(readability)
    total = avg(totals) if totals else (correctness * 0.6 + read * 0.4)

    return {
        "correctness": round(correctness, 2),
        "style": round(style, 2),
        "efficiency": round(efficiency, 2),
        "readability": round(read, 2),
        "total": round(total, 2),
        "feedback": "\n\n".join(feedback_texts) if feedback_texts else "",
    }


@app.post("/evaluate")
def evaluate(req: EvaluateRequest):
    assignment_pdf = _pick_assignment_pdf(req)
    submission_path = _build_submission_path(req)
    print(f"[rubric-debug] Received rubric in /evaluate request: {req.rubric}")

    try:
        engine = RubricAwareEvaluationEngine(assignment_pdf, submission_path, rubric=req.rubric)
        results = engine.run()
        report = engine.generate_report()
        print("\n=== FULL AUTOGRADER REPORT START ===")
        print(report)
        print("=== FULL AUTOGRADER REPORT END ===\n")

        scores = _extract_scores(results)
        summary_feedback = scores.pop("feedback") or ""

        return {
            "submission_id": req.submission_id,
            "scores": scores,
            "total_score": scores.get("total", 0),
            # Store full engine report so UI can render complete evaluation details.
            "feedback_text": report,
            "summary_feedback": summary_feedback,
            "raw": results,  # helpful during development
        }
    finally:
        # Clean up temp submission dir if we created one
        if submission_path.is_dir() and submission_path.name.startswith(f"submission_{req.submission_id}_"):
            shutil.rmtree(submission_path, ignore_errors=True)

