from pathlib import Path
from typing import Literal


def infer_submission_language(filename: str) -> Literal["python", "cpp"]:
    ext = Path(filename).suffix.lower()
    if ext in (".cpp", ".cxx", ".cc", ".c++"):
        return "cpp"
    if ext == ".py":
        return "python"
    raise ValueError(
        f"Unsupported submission extension {ext!r} for {filename!r}; "
        "expected .py or .cpp"
    )


def execution_context_for_test_generation(language: str) -> str:
    if language == "cpp":
        return (
            "The autograder compiles the submission with g++ using "
            "`-std=c++17 -O2 -pipe`, then runs it as a console program with stdin from a shell pipe.\n"
            "Run shape: `echo \"<stdin text>\" | <compiled_binary>`.\n"
            'Each test case\'s "input" dict is turned into one stdin string (one value as-is, '
            "or multiple values joined by single ASCII spaces). "
            "expected_output must match what the program prints to stdout (after trimming "
            "noise the same way as for Python)."
        )
    return (
        "The autograder runs the submission as a Python script with stdin from a shell pipe.\n"
        "Run shape: `echo \"<stdin text>\" | python3 <file.py>`.\n"
        'Each test case\'s "input" dict is turned into one stdin string (one value as-is, '
        "or multiple values joined by single ASCII spaces). "
        "expected_output must match what the program prints to stdout."
    )
