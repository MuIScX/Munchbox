import os
import sys
import json
import subprocess
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text
from datetime import datetime
from app.services.forecaster import run_forecast_job

from app.db import get_db
from app.core.security import decode_token
from app.schemas.report import PredictRecordRequest,PredictReportRequest, PredictIngredientRequest, PredictTrendRequest, PredictGenerateRequest
from app.models.predict import Predict, PredictSet
from app.models.ingredient import Ingredient

router = APIRouter(prefix="/api/predict", tags=["Predict"])

_SCRIPT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "BayesianTimeSeriesModel", "src", "Bayes_Inventory_Imp_v3-2-5_sql.py")
)
# Allow using a separate Python env that has PyMC installed
_PYTHON_PATH = os.environ.get("MUNCHBOX_PYTHON_PATH", sys.executable)


@router.post("/generate")
def generate_predictions(body: PredictGenerateRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    """Run Bayesian model for active ingredients and persist results."""
    restaurant_id = identity["restaurantId"]

    q = db.query(Ingredient).filter(Ingredient.restaurant_id == restaurant_id, Ingredient.is_active == 1)
    if body.ingredient_id is not None:
        q = q.filter(Ingredient.id == body.ingredient_id)
    ingredients = q.all()

    if not ingredients:
        return {"message": "No active ingredients found", "Data": {"total_processed": 0, "predictions": []}}

    results = []
    errors  = []

    for ingredient in ingredients:
        try:
            payload = run_forecast_job(
                restaurant_id=restaurant_id,
                sell_price=150.0,
                buy_price=100.0,
                start_date=body.start_date,
                end_date=body.end_date,
                strategy=body.strategy,
                ingredient_name=ingredient.name,
                ingredient_id=ingredient.id,
                save_to_db=True,        # forecaster handles DB insert internally
                return_chart=True,      # needed to extract upper/lower bounds
            )

            if "error" in payload:
                errors.append({"ingredient": ingredient.name, "error": payload["error"]})
                continue

            rec         = payload["recommendation"]
            future_view = payload["chart_data"]["future_view"]

            expected_usage = float(rec["expected_usage"])
            upper_bound          = round(sum(d["likely_high_bound_95th"] for d in future_view), 2) if future_view else None
            lower_bound          = round(sum(d["likely_low_bound_5th"]   for d in future_view), 2) if future_view else None
            daily_target_average = round(expected_usage / len(future_view), 2)                     if future_view else None

            results.append({
                "ingredient_id":   ingredient.id,
                "ingredient_name": ingredient.name,
                "expected_usage":  expected_usage,
                "upper_bound":     upper_bound,
                "lower_bound":     lower_bound,
            })

        except Exception as e:
            errors.append({"ingredient": ingredient.name, "error": str(e)})

    return {
        "message": "success",
        "Data": {
            "total_processed": len(results),
            "predictions":     results,
            "errors":          errors,
        },
    }

@router.post("/ingredient-forecast")
def get_ingredient_forecast(body: PredictIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    """Return daily forecast rows (prediction_type=1) from the latest predict_set for an ingredient."""
    restaurant_id = identity["restaurantId"]

    # Step 1: Find the latest predict_set ID for this ingredient
    latest_set = (
        db.query(Predict.prediction_set)
        .filter(
            Predict.ingredient_id   == body.ingredient_id,
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 1,
        )
        .order_by(Predict.timestamp.desc())
        .first()
    )

    if not latest_set:
        return {"message": "success", "Data": []}

    latest_set_id = latest_set[0]

    # Step 2: Query daily rows ordered by date
    q = (
        db.query(
            Predict.timestamp,
            Predict.expected_usage,
            Predict.upper_bound,
            Predict.lower_bound,
        )
        .filter(
            Predict.ingredient_id   == body.ingredient_id,
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_set  == latest_set_id,
            Predict.prediction_type == 1,
        )
        .order_by(Predict.timestamp.asc())
    )

    # Step 3: Slice to requested days if provided
    if body.days is not None:
        q = q.limit(body.days)

    rows = q.all()

    return {"message": "success", "Data": [
        {
            "date":        str(r[0].date()) if r[0] else None,
            "mean_demand": float(r[1])      if r[1] is not None else None,
            "high_bound":  float(r[2])      if r[2] is not None else None,
            "low_bound":   float(r[3])      if r[3] is not None else None,
        }
        for r in rows
    ]}

@router.post("/report")
def predicted_report(body: PredictReportRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant_id = identity["restaurantId"]
    print(body)
    # Step 1: Find latest predict_set per ingredient
    latest_set_sub = (
        db.query(
            Predict.ingredient_id,
            func.max(Predict.prediction_set).label("latest_set")
        )
        .filter(
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 2,
        )
        .group_by(Predict.ingredient_id)
        .subquery()
    )

    # Step 2: Get daily rows from latest set, filtered by days if requested
    daily_q = (
        db.query(
            Predict.ingredient_id,
            Predict.prediction_set,
            Predict.expected_usage,
            Predict.upper_bound,
            Predict.lower_bound,
            Predict.timestamp,
        )
        .join(latest_set_sub, (latest_set_sub.c.ingredient_id == Predict.ingredient_id)
              & (latest_set_sub.c.latest_set == Predict.prediction_set))
        .filter(
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 1,
        )
        .order_by(Predict.ingredient_id, Predict.timestamp.asc())
    )

    # Apply days filter — take only the first N days from the forecast
    daily_rows = daily_q.all()

    # Group by ingredient, slice to requested days
    from collections import defaultdict
    grouped = defaultdict(list)
    for r in daily_rows:
        grouped[r.ingredient_id].append(r)

    if body.days is not None:
        grouped = {ing_id: rows[:body.days] for ing_id, rows in grouped.items()}

    # Step 3: Aggregate per ingredient
    aggregated = {}
    for ing_id, rows in grouped.items():
        aggregated[ing_id] = {
            "prediction_set":       rows[0].prediction_set,
            "total_expected_usage": round(sum(r.expected_usage for r in rows), 2),
            "total_upper_bound":    round(sum(r.upper_bound   for r in rows if r.upper_bound is not None), 2),
            "total_lower_bound":    round(sum(r.lower_bound   for r in rows if r.lower_bound is not None), 2),
            "day_count":            len(rows),
        }

    # Step 4: Get daily_target_average from summary rows
    summary_rows = (
        db.query(Predict.ingredient_id, Predict.daily_target_average, Predict.prediction_set)
        .join(latest_set_sub, (latest_set_sub.c.ingredient_id == Predict.ingredient_id)
              & (latest_set_sub.c.latest_set == Predict.prediction_set))
        .filter(
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 2,
        )
        .all()
    )
    summary_map = {r.ingredient_id: r.daily_target_average for r in summary_rows}

    # Step 5: Join with ingredient info
    if not aggregated:
        return {"message": "success", "Data": []}

    ingredients = (
        db.query(Ingredient)
        .filter(
            Ingredient.restaurant_id == restaurant_id,
            Ingredient.is_active     == 1,
            Ingredient.id.in_(list(aggregated.keys()))
        )
        .all()
    )
    ing_map = {i.id: i for i in ingredients}

    result = []
    for ing_id, agg in aggregated.items():
        ing = ing_map.get(ing_id)
        if not ing:
            continue

        total_usage = agg["total_expected_usage"]
        daily_avg   = summary_map.get(ing_id)

        # Recalculate daily_target_average for the sliced window if days filter applied
        if body.days is not None and agg["day_count"] > 0:
            daily_avg = round(total_usage / agg["day_count"], 2)

        result.append({
            "ingredient_id":        ing_id,
            "ingredient_name":      ing.name,
            "current_stock":        float(ing.stock_left),
            "expected_usage":       total_usage,
            "upper_bound":          agg["total_upper_bound"],
            "lower_bound":          agg["total_lower_bound"],
            "forecast_days":        agg["day_count"],
            "daily_target_average": daily_avg,
            "unit":                 ing.unit,
            "status":               1 if float(ing.stock_left) >= total_usage else 0,
        })

    return {"message": "success", "Data": result}


@router.post("/record")
def record_predict(body: PredictRecordRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    for item in body.predictions:
        db.add(Predict(
            ingredient_id=item.ingredient_id,
            prediction_type=item.prediction_type,
            expected_usage=item.expected_usage,
            upper_bound=item.upper_bound,
            lower_bound=item.lower_bound,
            daily_target_average=item.daily_target_average,
            prediction_set=body.predict_set_id,
            restaurant_id=identity["restaurantId"],
            timestamp=now,
        ))
    db.commit()
    return {"message": "Prediction recorded", "Data": []}


@router.post("/ingredient")
def get_predicted_ingredient(body: PredictIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    q = (
        db.query(
            Predict.ingredient_id, Predict.prediction_type, Predict.expected_usage,
            Predict.upper_bound, Predict.lower_bound, Predict.daily_target_average,
        )
        .join(Ingredient, Predict.ingredient_id == Ingredient.id)
        .filter(Predict.restaurant_id == identity["restaurantId"], Ingredient.is_active == 1)
    )
    if body.ingredient_id is not None:
        q = q.filter(Predict.ingredient_id == body.ingredient_id)
    return {"message": "success", "Data": [
        {
            "ingredient_id": r[0], "prediction_type": r[1], "expected_usage": float(r[2]),
            "upper_bound": float(r[3]) if r[3] is not None else None,
            "lower_bound": float(r[4]) if r[4] is not None else None,
            "daily_target_average": float(r[5]) if r[5] is not None else None,
        }
        for r in q.all()
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
            Predict.expected_usage, Predict.upper_bound, Predict.lower_bound,
            Predict.daily_target_average, Ingredient.stock_left,
            case(
                (Ingredient.stock_left < Predict.expected_usage, 0),
                (Ingredient.stock_left == Predict.expected_usage, 1),
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
        {
            "id": r[0], "ingredient_id": r[1], "name": r[2],
            "expected_usage": float(r[3]),
            "upper_bound": float(r[4]) if r[4] is not None else None,
            "lower_bound": float(r[5]) if r[5] is not None else None,
            "daily_target_average": float(r[6]) if r[6] is not None else None,
            "stock_left": float(r[7]), "status": r[8],
        }
        for r in q.all()
    ]}


@router.post("/actual")
def get_actual_usage(body: PredictIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    """Return daily actual usage for an ingredient derived from sale_data × recipe."""
    restaurant_id = identity["restaurantId"]
    rows = db.execute(
        text("""
            SELECT DATE(S.timestamp) AS date, SUM(S.amount * R.amount) AS daily_usage
            FROM sale_data S
            JOIN recipe R ON S.menu_id = R.menu_id
            WHERE R.ingredient_id = :ingredient_id
              AND S.restaurant_id  = :restaurant_id
            GROUP BY DATE(S.timestamp)
            ORDER BY date ASC
        """),
        {"ingredient_id": body.ingredient_id, "restaurant_id": restaurant_id},
    ).fetchall()
    return {"message": "success", "Data": [
        {"date": str(r[0]), "actual_usage": float(r[1])} for r in rows
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
        db.query(
            Predict.timestamp, Predict.expected_usage,
            Predict.upper_bound, Predict.lower_bound, Predict.daily_target_average,
            Predict.prediction_type,
        )
        .join(latest_sub, Predict.timestamp == latest_sub.c.max_ts)
        .filter(Predict.ingredient_id == body.ingredient_id, Predict.restaurant_id == restaurant_id)
        .order_by(Predict.timestamp.asc())
        .all()
    )
    return {"message": "success", "Data": {
        "ingredient_id": body.ingredient_id,
        "data": [
            {
                "timestamp":            str(r[0]),
                "expected_usage":       float(r[1]),
                "upper_bound":          float(r[2]) if r[2] is not None else None,
                "lower_bound":          float(r[3]) if r[3] is not None else None,
                "daily_target_average": float(r[4]) if r[4] is not None else None,
                "prediction_type":      r[5],
            }
            for r in rows
        ],
    }}