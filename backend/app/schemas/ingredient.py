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


class IngredientStockItem(BaseModel):
    ingredient_id: int
    new_stock: float


class IngredientStockUpdate(BaseModel):
    updates: list[IngredientStockItem]
    staff_id: Optional[int] = None
    action_type: Optional[int] = None  # 1 = RESTOCK, 2 = RECHECK


class IngredientStatusRequest(BaseModel):
    ingredient_id: Optional[int] = None


class IngredientLogRequest(BaseModel):
    ingredient_id: Optional[int] = None


class IngredientDelete(BaseModel):
    ingredient_id: int


class IngredientUpdate(BaseModel):
    ingredient_id: int
    name: str
    category: int
    unit: str
