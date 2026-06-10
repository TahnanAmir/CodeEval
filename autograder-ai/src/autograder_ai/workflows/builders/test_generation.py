from langgraph.graph import StateGraph, END
from ..states import TestGenerationState
from ..nodes.test_generation import (
    analyze_question_node,
    analyze_code_node,
    generate_test_cases_node,
    validate_tests_node
)

class TestGenerationBuilder():
    """Builds the test generation workflow graph"""
    def __init__(self, llm):
        self.llm = llm

    def build(self):
        """Build the workflow graph"""
        workflow = StateGraph(TestGenerationState)

        workflow.add_node("analyze_question", analyze_question_node)
        workflow.add_node("analyze_code", analyze_code_node)
        workflow.add_node("generate_tests", generate_test_cases_node(self.llm))
        workflow.add_node("validate_tests", validate_tests_node)

        workflow.set_entry_point("analyze_question")
        workflow.add_edge("analyze_question", "analyze_code")
        workflow.add_edge("analyze_code", "generate_tests")
        workflow.add_edge("generate_tests", "validate_tests")
        workflow.add_edge("validate_tests", END)

        return workflow.compile()

