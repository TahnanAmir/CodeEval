import re


def sanitize_json(text: str) -> str:
    # Replace Python None with JSON null
    text = re.sub(r'\bNone\b', 'null', text)
    # Replace Python True with JSON true
    text = re.sub(r'\bTrue\b', 'true', text)
    # Replace Python False with JSON false
    text = re.sub(r'\bFalse\b', 'false', text)
    # Remove trailing commas before closing brackets/braces
    text = re.sub(r',(\s*[}\]])', r'\1', text)
    return text


def extract_json(text: str) -> str:
    code_block_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL)
    if code_block_match:
        return sanitize_json(code_block_match.group(1))

    json_match = re.search(r'(\[.*\])', text, re.DOTALL)
    if json_match:
        return sanitize_json(json_match.group(1))

    return sanitize_json(text)
