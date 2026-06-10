import re
from typing import Dict, Any, Tuple


def format_input_for_stdin(input_dict: Dict[str, Any]) -> str:
    if len(input_dict) == 1:
        return str(list(input_dict.values())[0])

    return "\n".join(str(v) for v in input_dict.values())


def parse_agent_response(response: str) -> Tuple[bool, str, str]:
    passed = False
    actual_output = ""
    reasoning = ""

    result_match = re.search(r"RESULT:\s*(PASSED|FAILED)", response, re.IGNORECASE)
    if result_match:
        passed = result_match.group(1).upper() == "PASSED"

    output_match = re.search(
        r"ACTUAL OUTPUT:\s*(.*?)\s*(?:REASONING:|$)", response, re.DOTALL | re.IGNORECASE
    )
    if output_match:
        actual_output = output_match.group(1).strip()

    reasoning_match = re.search(
        r"REASONING:\s*(.*)", response, re.DOTALL | re.IGNORECASE
    )
    if reasoning_match:
        reasoning = reasoning_match.group(1).strip()

    return passed, actual_output, reasoning


def sanitize_file_path(path: str) -> str:
    return path.replace("'", "\\'").replace('"', '\\"')
