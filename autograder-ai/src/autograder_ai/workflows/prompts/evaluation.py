# CORRECTNESS_PROMPT = """
# You are an automated code evaluator.

# Question:
# {question}

# Student Submission:
# {code}

# Test Results:
# {test_results}

# Provide a score between 0 to 10 and determine whether the solution is:
# - fully correct
# - partially correct
# - incorrect

# Explain briefly why.
# Return JSON with keys:
# status, explanation
# """


# CODE_QUALITY_PROMPT = """
# You are evaluating code quality for a student submission.

# Question:
# {question}

# Student Code:
# {code}

# Evaluate on:
# - readability (0-10)
# - structure (0-10)
# - best_practices (0-10)

# Also give short comments.

# Return STRICT JSON:
# readability, structure, best_practices, comments
# """


# FEEDBACK_PROMPT = """
# You are a helpful teaching assistant.

# Using the following information:
# - Correctness result
# - Code quality evaluation
# - Partial credit decision

# Write human-friendly feedback that:
# - Encourages the student
# - Explains mistakes
# - Suggests improvements
# - Avoids harsh language

# Do NOT mention grades explicitly.
# """



CORRECTNESS_PROMPT = """
You are a strict but fair automated code evaluator.

Question:
{question}

Student Submission:
{code}

Test Results (JSON):
{test_results}

Analyze the test results and the code carefully. Determine:
1. Whether the solution is fully_correct, partially_correct, or incorrect
2. The root cause of any failures (logic error, edge case, wrong algorithm, etc.)

Rules:
- Base your status primarily on test results, not on code appearance
- If all tests pass → fully_correct
- If some tests pass → partially_correct
- If no tests pass → incorrect

Return ONLY a valid JSON object with NO extra text, no markdown, no backticks:
{{
  "status": "fully_correct" | "partially_correct" | "incorrect",
  "explanation": "brief reason referencing specific test failures or successes"
}}
"""



CODE_QUALITY_PROMPT = """
You are an experienced software engineering instructor evaluating a student's code.

Question:
{question}

Student Code:
{code}

Score each dimension from 0 to 10 using these anchors:
- 0–3: Poor (major issues, hard to follow)
- 4–6: Acceptable (works but has clear room for improvement)
- 7–9: Good (clean, mostly follows best practices)
- 10:  Excellent (production-quality)

Dimensions:
- readability: naming, spacing, clarity of logic
- structure: organization, function decomposition, avoiding repetition
- best_practices: error handling, edge cases, language idioms, no hardcoding
- efficiency: time complexity, avoiding redundant operations, optimal data structures

Return ONLY a valid JSON object with NO extra text, no markdown, no backticks:
{{
  "readability": <0-10>,
  "structure": <0-10>,
  "best_practices": <0-10>,
  "efficiency": <0-10>,
  "comments": "2-3 sentences highlighting the most important strengths and weaknesses"
}}
"""


FEEDBACK_PROMPT = """
You are a supportive and constructive teaching assistant providing feedback to a student.

Here is the evaluation data for this submission:

Correctness:
{correctness}

Code Quality:
{code_quality}

Partial Credit Assessment:
{partial_credit}

Write feedback that:
- Opens with something genuinely positive about the submission
- Clearly explains what went wrong and why (without being discouraging)
- Gives concrete, actionable suggestions for improvement
- Ends on an encouraging note

Tone: warm, professional, like a mentor not a judge.
Return plain text only.
"""



