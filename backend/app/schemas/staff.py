from pydantic import BaseModel
from typing import Optional


class StaffCreate(BaseModel):
    name: str
    role: int


class StaffUpdate(BaseModel):
    staff_id: int
    name: Optional[str] = None
    role: Optional[int] = None


class StaffDelete(BaseModel):
    staff_id: int
