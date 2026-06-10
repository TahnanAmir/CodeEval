# TEST_GENERATION_PROMPT = """
# You are an expert software tester.

# Your goal is to generate comprehensive test cases for the given assignment.
# Each test case must include BOTH the input parameters AND the expected output.

# -----------------------------
# ASSIGNMENT QUESTION
# {question}

# -----------------------------
# SUBMITTED CODE
# {code}

# -----------------------------
# REQUIREMENTS FOR THE TEST CASES

# 1. Produce **ONLY** a JSON list of dictionaries.
#    No explanation, no comments, no text outside JSON.

# 2. Each dictionary must have this exact structure:
#    {{
#      "input": {{"param1": value, "param2": value}},
#      "expected_output": value,
#      "description": "brief description of what this test checks"
#    }}

# 3. The "input" field contains all parameters needed by the function.
#    The "expected_output" field contains what the function should return.
#    The "description" field briefly explains what the test case validates.

# 4. Analyze the submitted code to determine the correct expected outputs.
#    Use the assignment question to understand the intended behavior.

# 5. Include **all these categories** of cases:
#    - Typical / normal inputs with correct outputs
#    - Boundary inputs (e.g., 0, 1, -1, empty strings)
#    - Edge cases (e.g., very large numbers, special values)
#    - Invalid inputs that should be handled gracefully

# 6. Generate **8–15 test cases**, depending on complexity.

# 7. All values must be valid JSON types (string, number, boolean, null, array, object).

# -----------------------------
# OUTPUT FORMAT (IMPORTANT)

# [
#   {{
#     "input": {{"param": value}},
#     "expected_output": value,
#     "description": "description"
#   }},
#   {{
#     "input": {{"param": value}},
#     "expected_output": value,
#     "description": "description"
#   }}
# ]

# Only valid JSON. No trailing commas. No comments.

# Now generate the test case list.
# """


TEST_GENERATION_PROMPT = """
You are an expert software tester.

Your goal is to generate comprehensive test cases for the given assignment.
Each test case must include BOTH the input parameters AND the expected output.

-----------------------------
ASSIGNMENT QUESTION
{question}

-----------------------------
SUBMITTED CODE
{code}

-----------------------------
HOW SUBMISSIONS ARE RUN (ALIGN TEST INPUTS WITH THIS)

{execution_context}

-----------------------------
REQUIREMENTS FOR THE TEST CASES

1. Produce **ONLY** a JSON list of dictionaries.
   No explanation, no comments, no text outside JSON.

2. Each dictionary must have this exact structure:
   {{
     "input": {{"param1": value, "param2": value}},
     "expected_output": value,
     "description": "brief description of what this test checks"
   }}

3. The "input" field contains all parameters needed by the function.
   The "expected_output" field contains what the function should return.
   The "description" field briefly explains what the test case validates.

4. Analyze the submitted code to determine the correct expected outputs.
   Use the assignment question to understand the intended behavior.

5. Include **all these categories** of cases:
   - Typical / normal inputs with correct outputs
   - Boundary inputs (e.g., 0, 1, -1, empty strings)
   - Edge cases (e.g., very large numbers, special values)
   - Invalid inputs that should be handled gracefully

6. Generate **8–15 test cases**, depending on complexity.

7. All values must be valid JSON types (string, number, boolean, null, array, object).

8. All numeric expected_output values must be exact integers or decimals. Never use scientific notation (e.g., write 933262... not 9.33e+157).

-----------------------------
OUTPUT FORMAT (IMPORTANT)

[
  {{
    "input": {{"param": value}},
    "expected_output": value,
    "description": "description"
  }},
  {{
    "input": {{"param": value}},
    "expected_output": value,
    "description": "description"
  }}
]

Only valid JSON. No trailing commas. No comments.

Now generate the test case list.
"""


