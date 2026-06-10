from typing import List

from .base import BaseFileHandler


class CodeFileHandler(BaseFileHandler):
    @property
    def valid_extensions(self) -> List[str]:
        return [".py", ".cpp", ".c", ".java", ".js", ".ts"]

    def read(self) -> str:
        with open(self.file_path, "r", encoding="utf-8") as f:
            return f.read()
