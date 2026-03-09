from pydantic import BaseModel
from typing import Optional
from datetime import date


class RestaurantGet(BaseModel):
    restaurant_id: int


class RestaurantCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    package: int
    manager_pin: Optional[int] = None


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    package: Optional[int] = None
    manager_pin: Optional[int] = None