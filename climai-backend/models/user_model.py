from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    id: Optional[int]
    name: str
    email: str
    password_hash: str

    def to_public_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "email": self.email}
