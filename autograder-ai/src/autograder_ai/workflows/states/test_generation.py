from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict


class TestCase(TypedDict):
    """Schema for a single test case"""
    input: Dict[str, Any]
    expected_output: Any
    description: Optional[str]


class TestGenerationState(TypedDict):
    """State for the test generation workflow"""
    question_id: str
    question: str
    code: str
    language: str
    test_cases: List[TestCase]

