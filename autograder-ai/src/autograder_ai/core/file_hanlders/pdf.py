from typing import List
import PyPDF2

from .base import BaseFileHandler


class PDFFileHandler(BaseFileHandler):

    @property
    def valid_extensions(self) -> List[str]:
        return [".pdf"]

    def read(self) -> str:
        with open(self.file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text
