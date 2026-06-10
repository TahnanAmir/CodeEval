import re
from pathlib import Path
from typing import Dict

from .base import BasePreProcessor
from ..file_hanlders import CodeFileHandler


class SubmissionPreProcessor(BasePreProcessor):
    FILENAME_PATTERN = re.compile(r"^q_\w+", re.IGNORECASE)

    def __init__(self, submission_path: str):
        self.submission_path = Path(submission_path)
        self._validate_submission_path()
        self._validate_filenames()

    def _validate_submission_path(self):
        if not self.submission_path.is_dir():
            raise NotADirectoryError(
                f"Submission path must be a directory: {self.submission_path}"
            )

    def _validate_filenames(self):
        invalid_files = [
            f.name
            for f in self.submission_path.iterdir()
            if f.is_file() and not self.FILENAME_PATTERN.match(f.name)
        ]
        if invalid_files:
            raise ValueError(
                f"The following submission files are not labeled as q_*: {invalid_files}"
            )

    def run(self) -> Dict[str, str]:
        submissions = {}
        for file in self.submission_path.iterdir():
            if file.is_file():
                handler = CodeFileHandler(str(file))
                submissions[file.name] = handler.read()
        return submissions
