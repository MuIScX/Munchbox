from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, time as dt_time
import pytz

from app.db import get_db
from app.core.security import decode_token
from app.schemas.restaurant import RestaurantCreate, RestaurantUpdate
from app.models.restaurant import RestaurantInfo
import app.services.scheduler as sched

router = APIRouter(prefix="/api/restaurant", tags=["Restaurant"])
bkk = pytz.timezone("Asia/Bangkok")

# Injected by main.py after scheduler is created
_reschedule_fn = None

def set_reschedule_fn(fn):
    global _reschedule_fn
    _reschedule_fn = fn


@router.post("/get")
def get_restaurant(
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    restaurant = db.query(RestaurantInfo).filter(RestaurantInfo.id == identity["restaurantId"]).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return {
        "message": "success",
        "Data": {
            "id":                   restaurant.id,
            "name":                 restaurant.name,
            "start_date":           str(restaurant.start_date),
            "end_date":             str(restaurant.end_date),
            "package":              restaurant.package,
            "updated_time":         str(restaurant.updated_time),
            "manager_pin":          restaurant.manager_pin,
            "prediction_frequency":  restaurant.prediction_frequency,
            "prediction_days_ahead": restaurant.prediction_days_ahead if restaurant.prediction_days_ahead is not None else 7,
            "prediction_run_time":   restaurant.prediction_run_time.strftime("%H:%M") if restaurant.prediction_run_time else "00:00",
            "next_prediction_run":   sched.get_next_run(restaurant.id),
        },
    }


@router.post("/create", status_code=201)
def create_restaurant(
    body: RestaurantCreate,
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    restaurant = RestaurantInfo(
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        package=body.package,
        updated_time=datetime.now(bkk).time(),
        manager_pin=body.manager_pin,
        prediction_frequency=body.prediction_frequency,
        prediction_days_ahead=body.prediction_days_ahead if body.prediction_days_ahead is not None else 7,
        prediction_run_time=body.prediction_run_time,
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return {"message": "success", "Data": {"restaurant_id": restaurant.id}}


@router.put("/update")
def update_restaurant(
    body: RestaurantUpdate,
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    restaurant = db.query(RestaurantInfo).filter(RestaurantInfo.id == identity["restaurantId"]).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if body.name                 is not None: restaurant.name                 = body.name
    if body.start_date           is not None: restaurant.start_date           = body.start_date
    if body.end_date             is not None: restaurant.end_date             = body.end_date
    if body.package              is not None: restaurant.package              = body.package
    if body.manager_pin          is not None: restaurant.manager_pin          = body.manager_pin
    if body.prediction_frequency is not None:
        restaurant.prediction_frequency = body.prediction_frequency if body.prediction_frequency > 0 else None
    if body.prediction_days_ahead is not None:
        restaurant.prediction_days_ahead = body.prediction_days_ahead if body.prediction_days_ahead > 0 else 7
    if body.prediction_run_time is not None:
        restaurant.prediction_run_time = body.prediction_run_time

    restaurant.updated_time = datetime.now(bkk).time()

    db.commit()

    # Reschedule the prediction job if any scheduling field changed
    if (body.prediction_frequency is not None or body.prediction_days_ahead is not None or body.prediction_run_time is not None) and _reschedule_fn:
        run_time = restaurant.prediction_run_time or dt_time(0, 0)
        _reschedule_fn(
            restaurant.id,
            restaurant.prediction_frequency if restaurant.prediction_frequency else None,
            restaurant.prediction_days_ahead or 7,
            run_time,
        )

    return {"message": "success", "Data": []}