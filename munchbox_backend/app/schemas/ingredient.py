from pydantic import BaseModel
from typing import Optional


class IngredientListRequest(BaseModel):
    menu_id: Optional[int] = None
    ingredient_id: Optional[int] = None
    category: Optional[int] = None


class IngredientCreate(BaseModel):
    name: str
    unit: str
    category: int


class IngredientStockUpdate(BaseModel):
    ingredient_id: int
    new_stock: float
    staff_id: int


class IngredientStatusRequest(BaseModel):
    ingredient_id: Optional[int] = None


class IngredientLogRequest(BaseModel):
    ingredient_id: Optional[int] = None


class IngredientDelete(BaseModel):
    ingredient_id: int
