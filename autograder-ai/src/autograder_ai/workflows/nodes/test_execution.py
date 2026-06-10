import subprocess
import time
import tempfile
from pathlib import Path
from typing import Dict, Any
from langchain_core.messages import HumanMessage
from langchain_community.tools import ShellTool
from langchain.agents import create_agent

from ..states import TestExecutionState, TestResult, EvaluationStatus
from ..prompts import build_test_execution_prompt
from ...utils import parse_agent_response


def _format_input_for_stdin(input_params: Dict[str, Any]) -> str:

    if len(input_params) == 1:
        return str(list(input_params.values())[0])

    return " ".join(str(v) for v in input_params.values())


def setup_code_file_node(state: TestExecutionState) -> TestExecutionState:
    print("  → Setting up code file for execution")

    language = state.get("language") or "python"
    suffix = ".cpp" if language == "cpp" else ".py"

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=suffix, delete=False, dir="/tmp", prefix="code_"
    ) as f:
        f.write(state["code"])
        temp_path = f.name

    state["code_file_path"] = temp_path
    state["status"] = EvaluationStatus.PROCESSING

    if language == "cpp":
        exe_path = str(Path(temp_path).with_suffix(""))
        try:
            completed = subprocess.run(
                [
                    "g++",
                    "-std=c++17",
                    "-O2",
                    "-pipe",
                    "-o",
                    exe_path,
                    temp_path,
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except FileNotFoundError:
            state["compilation_error"] = (
                "g++ not found on PATH; install a C++ compiler (e.g. build-essential) "
                "to evaluate C++ submissions."
            )
            print(f"  ✗ {state['compilation_error']}")
        except subprocess.TimeoutExpired:
            state["compilation_error"] = "C++ compilation timed out after 120s"
            print("  ✗ Compilation timed out")
        else:
            if completed.returncode != 0:
                err = (completed.stderr or completed.stdout or "").strip() or "g++ failed"
                state["compilation_error"] = err
                print(f"  ✗ Compilation failed: {err[:500]}")
            else:
                state["executable_path"] = exe_path
                print(f"  ✓ Built executable: {exe_path}")
    else:
        print(f"  ✓ Code written to: {temp_path}")

    return state


def initialize_execution_node(state: TestExecutionState) -> TestExecutionState:
    print(f"  → Initializing test execution for {state['question_id']}")

    state["current_test_index"] = 0
    state["test_results"] = []
    state["status"] = EvaluationStatus.PROCESSING

    compile_err = state.get("compilation_error")
    if compile_err:
        for test_idx, test_case in enumerate(state["test_cases"]):
            test_result: TestResult = {
                "test_index": test_idx,
                "description": test_case.get("description", ""),
                "input": test_case["input"],
                "expected_output": test_case["expected_output"],
                "actual_output": None,
                "passed": False,
                "reasoning": f"C++ compilation failed: {compile_err}",
                "execution_error": compile_err,
                "execution_time": None,
            }
            state["test_results"].append(test_result)
        state["current_test_index"] = len(state["test_cases"])
        print(f"  ✗ Skipping {len(state['test_cases'])} tests due to compile error")
        return state

    print(f"  ✓ Found {len(state['test_cases'])} test cases to execute")

    return state


def should_continue_testing(state: TestExecutionState) -> str:
    if state["current_test_index"] < len(state["test_cases"]):
        return "execute_test"
    else:
        return "finalize"


def execute_single_test_node(llm):

    def node(state: TestExecutionState) -> TestExecutionState:
        """Node: Execute a single test case using agent"""

        if state["current_test_index"] >= len(state["test_cases"]):
            return state

        test_idx = state["current_test_index"]
        test_case = state["test_cases"][test_idx]

        print(f"\n  → Executing Test {test_idx + 1}/{len(state['test_cases'])}")
        print(f"    Description: {test_case.get('description', 'N/A')}")

        stdin_input = _format_input_for_stdin(test_case["input"])
        language = state.get("language") or "python"

        shell_tool = ShellTool()
        agent = create_agent(model=llm, tools=[shell_tool])

        prompt = build_test_execution_prompt(
            language=language,
            code_file_path=state["code_file_path"],
            executable_path=state.get("executable_path"),
            stdin_input=stdin_input,
            description=test_case.get("description", "No description"),
            expected_output=test_case["expected_output"],
        )

        input_message = HumanMessage(content=prompt)

        start_time = time.time()
        actual_output = None
        reasoning = ""
        passed = False
        execution_error = None

        try:
            messages = []
            for step in agent.stream(
                {"messages": [input_message]}, stream_mode="values"
            ):
                messages.append(step["messages"][-1])

            last_message = messages[-1].content if messages else ""

            passed, actual_output, reasoning = parse_agent_response(last_message)

        except Exception as e:
            execution_error = str(e)
            reasoning = f"Execution failed with error: {execution_error}"
            passed = False
            actual_output = None
            print(f"    ✗ Error during execution: {e}")

        execution_time = time.time() - start_time

        test_result: TestResult = {
            "test_index": test_idx,
            "description": test_case.get("description", ""),
            "input": test_case["input"],
            "expected_output": test_case["expected_output"],
            "actual_output": actual_output,
            "passed": passed,
            "reasoning": reasoning,
            "execution_error": execution_error,
            "execution_time": execution_time,
        }

        state["test_results"].append(test_result)
        state["current_test_index"] += 1

        status_symbol = "✓" if passed else "✗"
        print(f"    {status_symbol} Test {'PASSED' if passed else 'FAILED'}")

        return state

    return node


def finalize_execution_node(state: TestExecutionState) -> TestExecutionState:
    print("\n  → Finalizing test execution")

    try:
        Path(state["code_file_path"]).unlink(missing_ok=True)
        print("  ✓ Cleaned up temporary source file")
    except Exception as e:
        print(f"  ! Warning: Could not delete temporary source file: {e}")

    exe = state.get("executable_path")
    if exe:
        try:
            Path(exe).unlink(missing_ok=True)
            print("  ✓ Cleaned up temporary executable")
        except Exception as e:
            print(f"  ! Warning: Could not delete temporary executable: {e}")

    total_tests = len(state["test_results"])
    passed_tests = sum(1 for result in state["test_results"] if result["passed"])

    state["status"] = EvaluationStatus.COMPLETED

    print(f"  ✓ Execution complete: {passed_tests}/{total_tests} tests passed")

    return state
