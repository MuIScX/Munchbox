from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app.core.security import decode_token
from app.schemas.restaurant import RestaurantCreate, RestaurantUpdate
from app.models.restaurant import RestaurantInfo

router = APIRouter(prefix="/api/restaurant", tags=["Restaurant"])


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
            "id":           restaurant.id,
            "name":         restaurant.name,
            "start_date":   str(restaurant.start_date),
            "end_date":     str(restaurant.end_date),
            "package":      restaurant.package,
            "updated_time": str(restaurant.updated_time),
            "manager_pin":  restaurant.manager_pin,
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
        updated_time=datetime.now().time(),  # auto-set on creation
        manager_pin=body.manager_pin,
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

    if body.name        is not None: restaurant.name        = body.name
    if body.start_date  is not None: restaurant.start_date  = body.start_date
    if body.end_date    is not None: restaurant.end_date    = body.end_date
    if body.package     is not None: restaurant.package     = body.package
    if body.manager_pin is not None: restaurant.manager_pin = body.manager_pin

    restaurant.updated_time = datetime.now().time()  # always auto-set on every update

    db.commit()
    return {"message": "success", "Data": []}