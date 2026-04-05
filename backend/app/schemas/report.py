from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class SaleItem(BaseModel):
    menu_id: int
    amount: int


class SaleRecordRequest(BaseModel):
    items: List[SaleItem] = []
    sale_date: Optional[date] = None

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


class PredictGenerateRequest(BaseModel):
    ingredient_id: Optional[int] = None
    start_date:    str
    end_date:      str
    strategy:      str = "2"


class PredictReportRequest(BaseModel):
    days: Optional[int] = None  # None = return all days from latest set
class PredictIngredientRequest(BaseModel):
    ingredient_id: Optional[int] = None
    days:          Optional[int] = None  # None = return all days
    predict_set_id: Optional[int] = None  # None = use latest

class PredictSetsRequest(BaseModel):
    ingredient_id: int


class PredictTrendRequest(BaseModel):
    ingredient_id: int


class PrepSummaryRequest(BaseModel):
    start_date: Optional[str] = None
    end_date:   Optional[str] = None