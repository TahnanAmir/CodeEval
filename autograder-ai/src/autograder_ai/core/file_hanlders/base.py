from typing import List
from abc import ABC, abstractmethod
from pathlib import Path


class BaseFileHandler(ABC):
    def __init__(self, filepath: str):
        self.file_path = Path(filepath)
        self._validate_path()
        self._validate_extension()

    def _validate_path(self):
        if not self.file_path.exists():
            raise FileNotFoundError(f"File does not exist: {self.file_path}")

    def _validate_extension(self):
        if self.file_path.suffix.lower() not in self.valid_extensions:
            raise ValueError(
                f"Invalid file extension '{self.file_path.suffix}' for file {self.file_path}. "
                f"Allowed extensions: {self.valid_extensions}"
            )

    @property
    @abstractmethod
    def valid_extensions(self) -> List[str]:
        pass

    @abstractmethod
    def read(self) -> str:
        pass
