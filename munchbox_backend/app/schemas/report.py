from pydantic import BaseModel
from typing import Optional, List


class SaleItem(BaseModel):
    menu_id: int
    amount: int


class SaleRecordRequest(BaseModel):
    items: List[SaleItem] = []


class ReportMenuRequest(BaseModel):
    menu_id: Optional[int] = None


class ReportIngredientRequest(BaseModel):
    ingredient_id: int


class MunchBoxUpdateRequest(BaseModel):
    restaurant_id: int


class PredictionItem(BaseModel):
    ingredient_id: int
    prediction_type: int
    amount_need: float


class PredictRecordRequest(BaseModel):
    predict_set_id: int
    predictions: List[PredictionItem]


class PredictIngredientRequest(BaseModel):
    ingredient_id: Optional[int] = None


class PredictTrendRequest(BaseModel):
    ingredient_id: int
