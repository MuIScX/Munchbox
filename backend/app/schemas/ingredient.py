from pydantic import BaseModel
from typing import Optional
from datetime import date


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
    as_of_date: Optional[date] = None
    restock_type: Optional[int] = None   # 1=before, 2=after


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
    reorder_point: Optional[float] = None


