from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime

from app.db import get_db
from app.core.security import decode_token
from app.schemas.report import PredictRecordRequest, PredictIngredientRequest, PredictTrendRequest
from app.models.predict import Predict, PredictSet
from app.models.ingredient import Ingredient

router = APIRouter(prefix="/api/predict", tags=["Predict"])


@router.post("/report")
def predicted_report(identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant_id = identity["restaurantId"]
    latest_sub = (
        db.query(Predict.ingredient_id, func.max(Predict.timestamp).label("latest_time"))
        .filter(Predict.restaurant_id == restaurant_id)
        .group_by(Predict.ingredient_id)
        .subquery()
    )
    rows = (
        db.query(
            Ingredient.id, Ingredient.name, Ingredient.stock_left,
            Predict.amount_need, Ingredient.unit,
            case((Ingredient.stock_left >= Predict.amount_need, 1), else_=0).label("status"),
        )
        .join(Predict, Predict.ingredient_id == Ingredient.id)
        .join(latest_sub, (Predict.ingredient_id == latest_sub.c.ingredient_id)
              & (Predict.timestamp == latest_sub.c.latest_time))
        .filter(Predict.restaurant_id == restaurant_id, Ingredient.is_active == 1)
        .all()
    )
    return {"message": "success", "Data": [
        {"ingredient_id": r[0], "ingredient_name": r[1], "current_stock": float(r[2]),
         "amount_need": float(r[3]), "unit": r[4], "status": r[5]}
        for r in rows
    ]}


@router.post("/record")
def record_predict(body: PredictRecordRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    for item in body.predictions:
        db.add(Predict(
            ingredient_id=item.ingredient_id,
            prediction_type=item.prediction_type,
            amount_need=item.amount_need,
            prediction_set=body.predict_set_id,
            restaurant_id=identity["restaurantId"],
            timestamp=now,
        ))
    db.commit()
    return {"message": "Prediction recorded", "Data": []}


@router.post("/ingredient")
def get_predicted_ingredient(body: PredictIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    q = (
        db.query(Predict.ingredient_id, Predict.prediction_type, Predict.amount_need)
        .join(Ingredient, Predict.ingredient_id == Ingredient.id)
        .filter(Predict.restaurant_id == identity["restaurantId"], Ingredient.is_active == 1)
    )
    if body.ingredient_id is not None:
        q = q.filter(Predict.ingredient_id == body.ingredient_id)
    return {"message": "success", "Data": [
        {"ingredient_id": r[0], "prediction_type": r[1], "amount_need": float(r[2])} for r in q.all()
    ]}


@router.post("/status")
def get_predicted_status(body: PredictIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant_id = identity["restaurantId"]
    latest_sub = (
        db.query(Predict.ingredient_id, func.max(Predict.timestamp).label("latest_time"))
        .filter(Predict.restaurant_id == restaurant_id)
        .group_by(Predict.ingredient_id)
        .subquery()
    )
    q = (
        db.query(
            Predict.id, Predict.ingredient_id, Ingredient.name,
            Predict.amount_need, Ingredient.stock_left,
            case(
                (Ingredient.stock_left < Predict.amount_need, 0),
                (Ingredient.stock_left == Predict.amount_need, 1),
                else_=2,
            ).label("status"),
        )
        .join(Ingredient, Predict.ingredient_id == Ingredient.id)
        .join(latest_sub, (Predict.ingredient_id == latest_sub.c.ingredient_id)
              & (Predict.timestamp == latest_sub.c.latest_time))
        .filter(Predict.restaurant_id == restaurant_id, Ingredient.is_active == 1)
    )
    if body.ingredient_id is not None:
        q = q.filter(Predict.ingredient_id == body.ingredient_id)
    return {"message": "success", "Data": [
        {"id": r[0], "ingredient_id": r[1], "name": r[2],
         "amount_need": float(r[3]), "stock_left": float(r[4]), "status": r[5]}
        for r in q.all()
    ]}


@router.post("/trend")
def predicted_trend(body: PredictTrendRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant_id = identity["restaurantId"]
    latest_sub = (
        db.query(
            func.date(Predict.timestamp).label("pred_date"),
            func.max(Predict.timestamp).label("max_ts"),
        )
        .filter(Predict.ingredient_id == body.ingredient_id, Predict.restaurant_id == restaurant_id)
        .group_by(func.date(Predict.timestamp))
        .subquery()
    )
    rows = (
        db.query(Predict.timestamp, Predict.amount_need)
        .join(latest_sub, Predict.timestamp == latest_sub.c.max_ts)
        .filter(Predict.ingredient_id == body.ingredient_id, Predict.restaurant_id == restaurant_id)
        .order_by(Predict.timestamp.asc())
        .all()
    )
    return {"message": "success", "Data": {
        "ingredient_id": body.ingredient_id,
        "data": [{"timestamp": str(r[0]), "amount_need": float(r[1])} for r in rows],
    }}
