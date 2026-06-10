from langgraph.graph import StateGraph, END
from ..states import EvaluationState
from ..nodes.evaluation import (
    evaluate_correctness,
    evaluate_code_quality,
    handle_partial_credit,
    apply_rubric,
    generate_feedback,
)


class EvaluationBuilder:
    def __init__(self, llm):
        self.llm = llm

    def build(self):
        graph = StateGraph(EvaluationState)

        graph.add_node("correctness", lambda s: evaluate_correctness(s, self.llm))
        graph.add_node("quality", lambda s: evaluate_code_quality(s, self.llm))
        graph.add_node("partial_credit", handle_partial_credit)
        graph.add_node("rubric", apply_rubric)
        graph.add_node("feedback", lambda s: generate_feedback(s, self.llm))
        
        graph.add_node("finalize", lambda s: {**s, "status": "completed"})

        graph.set_entry_point("correctness")

        graph.add_edge("correctness", "quality")
        graph.add_edge("quality", "partial_credit")

        graph.add_conditional_edges(
            "partial_credit",
            lambda s: "rubric" if s.get("rubric") else "feedback"
        )

        graph.add_edge("rubric", "feedback")
        graph.add_edge("feedback", "finalize")
        graph.add_edge("finalize", END)

        return graph.compile()
