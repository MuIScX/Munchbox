from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    restaurant_id: int
    email: str
    password: str
