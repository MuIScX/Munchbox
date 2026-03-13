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
    expected_usage: float
    upper_bound: Optional[float] = None
    lower_bound: Optional[float] = None
    daily_target_average: Optional[float] = None


class PredictRecordRequest(BaseModel):
    predict_set_id: int
    predictions: List[PredictionItem]


class PredictSetCreateRequest(BaseModel):
    model: int
    day_ahead: int


class PredictIngredientRequest(BaseModel):
    ingredient_id: Optional[int] = None


class PredictTrendRequest(BaseModel):
    ingredient_id: int