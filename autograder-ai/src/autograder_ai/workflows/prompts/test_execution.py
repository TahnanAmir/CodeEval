def build_test_execution_prompt(
    *,
    language: str,
    code_file_path: str,
    executable_path: str | None,
    stdin_input: str,
    description: str,
    expected_output: object,
) -> str:
    if language == "cpp":
        exe = executable_path or ""
        task = (
            f"The C++ submission was already compiled with g++ (-std=c++17 -O2 -pipe). "
            f"Run the executable at '{exe}' (source was '{code_file_path}'). "
            f"Do not compile again; run only the command below once."
        )
        run_command = f'echo "{stdin_input}" | {exe}'
    else:
        task = (
            f"Execute the Python file at '{code_file_path}' with the provided input "
            f"and validate its output."
        )
        run_command = f'echo "{stdin_input}" | python3 {code_file_path}'

    return f"""
You are a test execution agent responsible for running code and validating outputs.

TASK:
{task}

TEST DETAILS:
- Description: {description}
- Input to provide: {stdin_input}
- Expected output: {expected_output}

EXECUTION INSTRUCTIONS:
1. Run EXACTLY this command ONCE: {run_command}
2. Capture the actual output from stdout
3. INTELLIGENTLY extract the answer from the output (ignore prompts, extra text)
4. Compare the extracted answer with expected output
5. Determine if the test PASSED or FAILED
6. Provide clear reasoning for your decision

IMPORTANT RULES FOR OUTPUT PARSING:
- Execute the command EXACTLY ONCE - do not try multiple variations
- Pipe the input via stdin as shown above
- IGNORE surrounding text like input prompts, labels, or descriptive messages
- EXTRACT only the core answer or result value from the output

SEMANTIC EQUIVALENCE RULES:
- Boolean results:
  * A sentence containing "is <property>" (without "not") → True
  * A sentence containing "is not <property>" → False
  * Words like "yes", "valid", "found" → True
  * Words like "no", "invalid", "not found" → False
- Numeric results: Extract the number from the output, ignoring surrounding
  labels or sentences. Match it against the expected numeric value.
- String results: Extract the core answer string, ignoring leading/trailing
  whitespace, punctuation, and casing where appropriate.
- Type equivalence: True == "true" == "True", False == "false" == "False",
  1 == "1", etc.
- When the output is a sentence, identify the key value it conveys
  (a number, a boolean concept, a word) and compare that to expected_output.

CRITICAL: Once you extract a value and it matches expected_output,
mark PASSED immediately. Do NOT re-evaluate format, phrasing, or
sentence structure after a match is found. A value match is sufficient.

ERROR HANDLING:
- Exception raised AND expected_output is None → PASSED immediately.
  An exception on invalid input is acceptable behavior when None is expected.
  Do NOT mark this FAILED because "no exception was raised" — None means
  no valid result, and an exception also means no valid result.
- Exception raised AND expected_output is a concrete value → FAILED

OUTPUT FORMAT:
After execution, strictly respond with this format:
- RESULT: PASSED or FAILED
- ACTUAL OUTPUT: [the extracted answer/value from execution]
- REASONING: [detailed explanation including what you extracted and why]

Now execute the test ONCE using: {run_command}
"""
