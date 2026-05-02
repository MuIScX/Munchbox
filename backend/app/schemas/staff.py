from pydantic import BaseModel
from typing import Optional


class StaffCreate(BaseModel):
    name: str
    username: str
    password: str
    role: int


class StaffUpdate(BaseModel):
    staff_id: int
    name: Optional[str] = None
    role: int


class StaffDelete(BaseModel):
    staff_id: int


class ManagerPinVerify(BaseModel):
    pin: int


class StaffLoginRequest(BaseModel):
    username: str
    password: str


class StaffSelfUpdate(BaseModel):
    staff_id: int
    name: Optional[str] = None
    username: Optional[str] = None
    new_password: Optional[str] = None
    current_password: Optional[str] = None
