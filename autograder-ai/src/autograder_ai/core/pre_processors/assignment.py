import re
from typing import Dict

from .base import BasePreProcessor
from ..file_hanlders import PDFFileHandler


class AssignmentPreProcessor(BasePreProcessor):
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.pdf_file_handler = PDFFileHandler(self.file_path)

    def run(self) -> Dict[str, str]:
        text = self.pdf_file_handler.read()

        pattern = re.compile(
            r"Q(\d+)\s*[:.]\s*(.*?)(?=(?:Q\d+[:.])|\Z)",
            re.DOTALL | re.MULTILINE | re.IGNORECASE,
        )
        matches = pattern.findall(text)

        questions = {}
        for question_no_str, content in matches:
            key = f"q_{question_no_str}"
            questions[key] = content.strip()

        return questions
