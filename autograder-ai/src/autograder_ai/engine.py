from pathlib import Path
from typing import Dict, Any

from .core.pre_processors.assignment import AssignmentPreProcessor
from .utils.language import infer_submission_language
from .core.pre_processors.submission import SubmissionPreProcessor
from .workflows.builders.test_generation import TestGenerationBuilder
from .workflows.builders.test_execution import TestExecutionBuilder
from .workflows.builders.evaluation import EvaluationBuilder
from .clients.openai_client import OpenaiClient


class EvaluationEngine:
    def __init__(self, assignment_path: Path, submission_path: Path):
        self.assignment_path = assignment_path
        self.submission_path = submission_path
        self.results = {}

        openai_client = OpenaiClient()
        self.llm = openai_client.llm

        self.assignment_processor = AssignmentPreProcessor(str(assignment_path))
        self.submission_processor = SubmissionPreProcessor(str(submission_path))

    def _generate_tests(self) -> Dict[str, Any]:
        questions = self.assignment_processor.run()
        submissions = self.submission_processor.run()

        builder = TestGenerationBuilder(self.llm)
        workflow = builder.build()

        for question_id in questions:
            submission_file = None
            for filename in submissions:
                if filename.startswith(question_id):
                    submission_file = filename
                    break

            if not submission_file:
                print(f"No submission found for {question_id}")
                continue

            print(f"\nProcessing {question_id}...")

            language = infer_submission_language(submission_file)
            state = {
                "question_id": question_id,
                "question": questions[question_id],
                "code": submissions[submission_file],
                "language": language,
                "test_cases": [],
            }

            result = workflow.invoke(state)
            self.results[question_id] = result

        return self.results

    def _run_tests(self) -> Dict[str, Any]:
        if not self.results:
            raise RuntimeError("No test cases found. Run _generate_tests() first.")

        builder = TestExecutionBuilder(self.llm)
        workflow = builder.build()

        execution_results = {}

        for question_id, gen_result in self.results.items():
            test_cases = gen_result.get("test_cases", [])

            if not test_cases:
                print(f"No test cases for {question_id}, skipping execution")
                continue

            print(f"\nExecuting tests for {question_id}...")

            state = {
                "question_id": question_id,
                "code": gen_result["code"],
                "code_file_path": "",
                "language": gen_result.get("language", "python"),
                "test_cases": test_cases,
                "current_test_index": 0,
                "test_results": [],
                "status": "pending",
            }

            result = workflow.invoke(state)
            execution_results[question_id] = result

            self.results[question_id]["test_results"] = result["test_results"]
            self.results[question_id]["execution_status"] = result["status"]

        return execution_results
    
    def _run_evaluation(self):
        builder = EvaluationBuilder(self.llm)
        workflow = builder.build()

        for question_id, result in self.results.items():
            if "test_results" not in result:
                continue

            state = {
                "question_id": question_id,
                "question": result["question"],
                "code": result["code"],
                "test_results": result["test_results"],
                "rubric": None,
                "status": "processing",
            }

            eval_result = workflow.invoke(state)
            self.results[question_id]["evaluation"] = eval_result


    def run(self):
        """Run complete evaluation: generate tests and execute them"""
        self._generate_tests()
        self._run_tests()
        self._run_evaluation()
        return self.results

    def generate_report(self) -> str:
        """Generate a formatted report of the test generation and execution results"""
        if not self.results:
            return "No results to report."

        report = "\n" + "=" * 70 + "\n"
        report += "AUTOGRADER EVALUATION REPORT\n"
        report += "=" * 70 + "\n"

        for question_id, result in self.results.items():
            report += f"\n{question_id.upper()}\n"
            report += "-" * 70 + "\n"
            report += f"Question: {result['question']}\n"

            test_cases = result.get("test_cases", [])
            report += f"Test cases generated: {len(test_cases)}\n"

            test_results = result.get("test_results", [])
            if test_results:
                passed = sum(1 for tr in test_results if tr["passed"])
                total = len(test_results)
                pass_rate = (passed / total * 100) if total > 0 else 0

                report += f"Tests executed: {total}\n"
                report += f"Tests passed: {passed} ({pass_rate:.1f}%)\n"
                report += f"Tests failed: {total - passed}\n\n"

                report += "DETAILED TEST RESULTS:\n"
                report += "-" * 70 + "\n"

                for i, tr in enumerate(test_results, 1):
                    status = "✓ PASSED" if tr["passed"] else "✗ FAILED"
                    report += f"\nTest {i}: {tr['description']}\n"
                    report += f"  Status: {status}\n"
                    report += f"  Input: {tr['input']}\n"
                    report += f"  Expected: {tr['expected_output']}\n"
                    report += f"  Actual: {tr['actual_output']}\n"
                    report += f"  Reasoning: {tr['reasoning']}\n"

                    if tr["execution_error"]:
                        report += f"  Error: {tr['execution_error']}\n"

                    if tr["execution_time"]:
                        report += f"  Time: {tr['execution_time']:.2f}s\n"
            else:
                report += "Tests not executed yet.\n"

            evaluation = result.get("evaluation")
            if evaluation:
                correctness = evaluation.get("correctness", {})
                report += "\nEVALUATION SUMMARY:\n"
                report += "-" * 70 + "\n"
                report += f"Correctness: {correctness.get('status', 'N/A')}\n"

                quality = evaluation.get("code_quality")
                if quality:
                    report += (
                        f"Code Quality - "
                        f"Readability: {quality.get('readability')}/10, "
                        f"Structure: {quality.get('structure')}/10, "
                        f"Best Practices: {quality.get('best_practices')}/10, "
                        f"Efficiency: {quality.get('efficiency')}/10\n"
                    )

                final_score = evaluation.get("final_score")
                if final_score:
                    report += f"Final Score: {final_score.get('total')}\n"

                feedback = evaluation.get("feedback")
                if feedback:
                    report += "\nFEEDBACK:\n"
                    report += feedback + "\n"


            report += "\n"

        return report

