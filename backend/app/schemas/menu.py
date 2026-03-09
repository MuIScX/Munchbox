from pydantic import BaseModel
from typing import Optional


class MenuCreate(BaseModel):
    name: str
    price: int
    type: int


class MenuUpdate(BaseModel):
    menu_id: int
    name: Optional[str] = None
    price: Optional[int] = None
    type: Optional[int] = None


class MenuDelete(BaseModel):
    menu_id: int


class MenuDetailRequest(BaseModel):
    menu_id: int


class RecipeDetailRequest(BaseModel):
    menu_id: int


class RecipeAdd(BaseModel):
    menu_id: int
    ingredient_id: int
    amount: float


class RecipeEdit(BaseModel):
    menu_id: int
    ingredient_id: int
    amount: float


class RecipeDelete(BaseModel):
    menu_id: int
    ingredient_id: int
