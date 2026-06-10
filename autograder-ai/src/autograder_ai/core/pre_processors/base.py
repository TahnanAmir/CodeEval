from abc import ABC, abstractmethod
from typing import Dict


class BasePreProcessor(ABC):
    @abstractmethod
    def run(self) -> Dict[str, str]:
        pass
