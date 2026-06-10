import argparse
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

from src.autograder_ai.engine import EvaluationEngine


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Autograder: evaluate one submission or a folder of per-student submission directories.",
    )

    parser.add_argument(
        "--assignment",
        required=True,
        type=Path,
        help="Path to the assignment PDF file.",
    )

    parser.add_argument(
        "--submission",
        required=True,
        type=Path,
        help="Path to a student's submission (file or directory), or a parent directory containing one subdirectory per student.",
    )

    parser.add_argument(
        "--max-workers",
        type=int,
        default=3,
        metavar="N",
        help="Maximum parallel evaluations when multiple student folders are detected (default: 3).",
    )

    return parser.parse_args()


def validate_paths(assignment: Path, submission: Path) -> None:
    """Check if provided files/folders exist."""
    if not assignment.exists():
        print(f"Assignment file not found: {assignment}", file=sys.stderr)
        sys.exit(1)

    if not submission.exists():
        print(f"Submission path not found: {submission}", file=sys.stderr)
        sys.exit(1)


def process_student(student_path: Path, assignment_path: Path) -> tuple[str, object]:
    """Run the engine for one student directory; intended for thread pool workers."""
    print(f"\nProcessing {student_path.name}")

    engine = EvaluationEngine(
        assignment_path=assignment_path,
        submission_path=student_path,
    )

    results = engine.run()
    report = engine.generate_report()
    return student_path.name, results, report


def main() -> None:
    load_dotenv()

    args = parse_args()
    validate_paths(args.assignment, args.submission)

    # Batch mode: parent directory with one subdirectory per student
    if args.submission.is_dir():
        student_dirs = sorted(d for d in args.submission.iterdir() if d.is_dir())
        if student_dirs:
            workers = max(1, min(args.max_workers, len(student_dirs)))
            print(f"\nDetected {len(student_dirs)} student submission folders (max_workers={workers}).")

            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {
                    executor.submit(process_student, student_dir, args.assignment): student_dir
                    for student_dir in student_dirs
                }

                for future in as_completed(futures):
                    student_dir = futures[future]
                    try:
                        name, _results, report = future.result()
                        print("\n" + "=" * 80)
                        print(f" REPORT FOR: {name}")
                        print("=" * 80)
                        print(report)
                        print(f"\nCompleted: {name}")
                    except Exception as exc:
                        print(f"\nFailed: {student_dir.name} -> {exc}", file=sys.stderr)

            return

    # Single submission (file, or a directory without student subfolders)
    print("\nSingle submission mode")
    engine = EvaluationEngine(args.assignment, args.submission)
    engine.run()
    print("\n" + "=" * 80)
    print(f" REPORT FOR: {args.submission.name}")
    print("=" * 80)
    print(engine.generate_report())


if __name__ == "__main__":
    main()
