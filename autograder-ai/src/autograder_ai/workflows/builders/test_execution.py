from langgraph.graph import StateGraph, END
from ..states import TestExecutionState
from ..nodes.test_execution import (
    setup_code_file_node,
    initialize_execution_node,
    execute_single_test_node,
    should_continue_testing,
    finalize_execution_node,
)


class TestExecutionBuilder:

    def __init__(self, llm):
        self.llm = llm

    def build(self):
        workflow = StateGraph(TestExecutionState)

        workflow.add_node("setup_code_file", setup_code_file_node)
        workflow.add_node("initialize", initialize_execution_node)
        workflow.add_node("execute_test", execute_single_test_node(self.llm))
        workflow.add_node("finalize", finalize_execution_node)

        workflow.set_entry_point("setup_code_file")

        workflow.add_edge("setup_code_file", "initialize")
        workflow.add_edge("initialize", "execute_test")

        workflow.add_conditional_edges(
            "execute_test",
            should_continue_testing,
            {
                "execute_test": "execute_test",  # Loop back for next test
                "finalize": "finalize",  # All tests done
            },
        )

        workflow.add_edge("finalize", END)

        return workflow.compile()
