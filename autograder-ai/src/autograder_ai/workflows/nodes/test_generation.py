import json
from typing import Any, Dict

from ..states import TestGenerationState, TestCase
from ..prompts import TEST_GENERATION_PROMPT
from ...utils import extract_json
from ...utils.language import execution_context_for_test_generation


def analyze_question_node(state: TestGenerationState) -> TestGenerationState:
    """Node: Analyze the assignment question"""
    print(f"  → Analyzing question: {state['question_id']}")
    return state


def analyze_code_node(state: TestGenerationState) -> TestGenerationState:
    """Node: Analyze the submitted code"""
    print(f"  → Analyzing submitted code")
    return state


def is_valid_test_case(case: Any) -> bool:
    """Check if a test case matches the TestCase schema"""
    if not isinstance(case, dict):
        return False

    # Check required fields
    if "input" not in case or "expected_output" not in case:
        return False

    # Validate input is a dict
    if not isinstance(case["input"], dict):
        return False

    # Description is optional but must be string if present
    if "description" in case and not isinstance(case["description"], str):
        return False

    return True

def generate_test_cases_node(llm):
    def node(state):
        lang = state.get("language") or "python"
        prompt = TEST_GENERATION_PROMPT.format(
            question=state["question"],
            code=state["code"],
            execution_context=execution_context_for_test_generation(lang),
        )

        response = llm.invoke(prompt)
        content = response.content

        # Extract JSON from the response
        json_str = extract_json(content)

        try:
            state["test_cases"] = json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"  ✗ Failed to parse JSON: {e}")
            print(f"  Response content: {content[:200]}...")
            state["test_cases"] = []

        return state

    return node

def validate_tests_node(state: TestGenerationState) -> TestGenerationState:
    """Validate that test cases match the TestCase schema"""
    raw_cases = state.get("test_cases", None)

    if not isinstance(raw_cases, list):
        print("  ✗ LLM returned a non-list -- resetting test_cases to empty list")
        state["test_cases"] = []
        return state

    validated: list[TestCase] = []

    for index, case in enumerate(raw_cases):
        if is_valid_test_case(case):
            validated.append(case)
        else:
            # Provide specific feedback on what's wrong
            if not isinstance(case, dict):
                print(f"  ✗ Test case {index} is not a dict. Skipping.")
            elif "input" not in case:
                print(f"  ✗ Test case {index} missing 'input' field. Skipping.")
            elif "expected_output" not in case:
                print(f"  ✗ Test case {index} missing 'expected_output' field. Skipping.")
            elif not isinstance(case["input"], dict):
                print(f"  ✗ Test case {index} 'input' is not a dict. Skipping.")
            elif "description" in case and not isinstance(case["description"], str):
                print(f"  ✗ Test case {index} 'description' is not a string. Skipping.")

    print(f"  ✓ Validated {len(validated)}/{len(raw_cases)} test cases")
    state["test_cases"] = validated
    return state

