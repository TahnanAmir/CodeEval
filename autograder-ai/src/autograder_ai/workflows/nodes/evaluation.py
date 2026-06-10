import json
from langchain_core.messages import HumanMessage
from ..states import EvaluationState
from ..prompts.evaluation import (
    CORRECTNESS_PROMPT,
    CODE_QUALITY_PROMPT,
    FEEDBACK_PROMPT,
)


def _invoke_llm(llm, prompt: str) -> str:
    msg = HumanMessage(content=prompt)
    response = llm.invoke([msg])
    return response.content


def evaluate_correctness(state: EvaluationState, llm):
    test_results = state.get("test_results", [])
    passed = sum(1 for tr in test_results if tr.get("passed"))
    total = len(test_results) or 1

    if passed == total:
        state["correctness"] = {
            "status": "fully_correct",
            "confidence": 1.0,
            "passed": passed,
            "total": total,
        }
        return state

    if passed == 0:
        state["correctness"] = {
            "status": "incorrect",
            "confidence": 0.0,
            "passed": passed,
            "total": total,
        }
        return state

    prompt = CORRECTNESS_PROMPT.format(
        question=state["question"],
        code=state["code"],
        test_results=json.dumps(test_results),
    )

    try:
        text = _invoke_llm(llm, prompt)
        parsed = json.loads(text)
    except Exception as e:
        parsed = {
            "status": "partially_correct",
            "explanation": f"LLM failure: {str(e)}"
        }

    state["correctness"] = {
        "status": parsed.get("status", "partially_correct"),
        "explanation": parsed.get("explanation", ""),
        "confidence": passed / total,
        "passed": passed,
        "total": total,
    }
    return state


def evaluate_code_quality(state: EvaluationState, llm):
    prompt = CODE_QUALITY_PROMPT.format(
        question=state["question"],
        code=state["code"],
    )

    try:
        text = _invoke_llm(llm, prompt)
        state["code_quality"] = json.loads(text)
    except Exception:
        state["code_quality"] = {
            "readability": 7,
            "structure": 7,
            "best_practices": 7,
            "efficiency": 7,
            "comments": "LLM unavailable"
        }

    return state


def handle_partial_credit(state: EvaluationState):
    passed = state["correctness"]["passed"]
    total = state["correctness"]["total"]

    score_ratio = passed / total

    state["partial_credit"] = {
        "eligible": score_ratio > 0.3,
        "suggested_score": round(score_ratio * 100, 2),
        "reason": (
            "Core logic partially correct but fails some cases"
            if score_ratio < 1 else "All cases passed"
        ),
    }
    return state


# def apply_rubric(state: EvaluationState):
#     if not state.get("rubric"):
#         return state

#     breakdown = {}
#     total_score = 0

#     for criteria, weight in state["rubric"].items():
#         if criteria == "correctness":
#             score = state["partial_credit"]["suggested_score"] * weight / 100
#         else:
#             avg_quality = sum(
#                 state["code_quality"].get(k, 7)
#                 for k in ["readability", "structure", "best_practices"]
#             ) / 30
#             score = avg_quality * weight

#         breakdown[criteria] = round(score, 2)
#         total_score += score

#     state["final_score"] = {
#         "total": round(total_score, 2),
#         "breakdown": breakdown,
#     }
#     return state


def apply_rubric(state: EvaluationState):
    if not state.get("rubric"):
        return state

    rubric = state["rubric"]
    quality = state.get("code_quality", {})
    partial = state.get("partial_credit", {})
    correctness_score = float(partial.get("suggested_score", 0.0))

    score_map = {
        "correctness": correctness_score,
        "readability": float(quality.get("readability", 0.0)) * 10.0,
        "style":       float(quality.get("best_practices", 0.0)) * 10.0,
        "efficiency":  float(quality.get("efficiency", 0.0)) * 10.0,
    }

    breakdown = {}
    for criteria, weight in rubric.items():
        raw = score_map.get(criteria)
        if raw is None:
            print(f"Warning: no score mapping for rubric criteria '{criteria}', defaulting to 0")
            raw = 0.0
        breakdown[criteria] = round(raw * (float(weight) / 100.0), 2)

    state["final_score"] = {
        "total": round(sum(breakdown.values()), 2),
        "breakdown": breakdown,
    }
    return state


# def generate_feedback(state: EvaluationState, llm):
#     prompt = FEEDBACK_PROMPT + f"""

# Correctness:
# {state.get("correctness")}

# Code Quality:
# {state.get("code_quality")}

# Partial Credit:
# {state.get("partial_credit")}
# """

#     try:
#         state["feedback"] = _invoke_llm(llm, prompt)
#     except Exception as e:
#         state["feedback"] = f"Feedback generation failed: {str(e)}"

#     return state



def generate_feedback(state: EvaluationState, llm):
    prompt = FEEDBACK_PROMPT.format(
        correctness=state.get("correctness"),
        code_quality=state.get("code_quality"),
        partial_credit=state.get("partial_credit"),
    )

    try:
        state["feedback"] = _invoke_llm(llm, prompt)
    except Exception as e:
        state["feedback"] = f"Feedback generation failed: {str(e)}"

    return state
