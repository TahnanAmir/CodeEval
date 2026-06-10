from enum import Enum
from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict, NotRequired


class EvaluationStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class TestResult(TypedDict):
    test_index: int
    description: str
    input: Dict[str, Any]
    expected_output: Any
    actual_output: Optional[str]
    passed: bool
    reasoning: str
    execution_error: Optional[str]
    execution_time: Optional[float]


class TestExecutionState(TypedDict):
    question_id: str
    code: str
    code_file_path: str
    language: str
    test_cases: List[Dict[str, Any]]
    current_test_index: int
    test_results: List[TestResult]
    status: EvaluationStatus
    executable_path: NotRequired[str]
    compilation_error: NotRequired[Optional[str]]


class EvaluationState(TypedDict):

    question_id: str
    question: str
    code: str
    test_results: List[TestResult]

    rubric: Optional[Dict[str, float]]

    correctness: Optional[Dict[str, Any]]
    code_quality: Optional[Dict[str, Any]]
    partial_credit: Optional[Dict[str, Any]]

    final_score: Optional[Dict[str, Any]]
    feedback: Optional[str]

    status: EvaluationStatus
