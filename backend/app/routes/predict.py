import os
import sys
import json
import subprocess
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text
from datetime import datetime

from app.db import get_db
from app.core.security import decode_token
from app.schemas.report import PredictRecordRequest, PredictIngredientRequest, PredictTrendRequest, PredictGenerateRequest
from app.models.predict import Predict, PredictSet
from app.models.ingredient import Ingredient

router = APIRouter(prefix="/api/predict", tags=["Predict"])

_SCRIPT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "BayesianTimeSeriesModel", "src", "Bayes_Inventory_Imp_v3-1_sql.py")
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

    predict_set_id = int(datetime.utcnow().timestamp())
    now = datetime.utcnow()
    results = []
    errors = []

    for ingredient in ingredients:
        try:
            proc = subprocess.run(
                [_PYTHON_PATH, _SCRIPT_PATH,
                 "--ingredient", ingredient.name,
                 "--ingredient_id", str(ingredient.id),
                 "--restaurant_id", str(restaurant_id),
                 "--sell_price", "100",
                 "--days", str(body.days),
                 "--strategy", body.strategy],
                capture_output=True,
                text=True,
                timeout=600,
            )
            stdout = proc.stdout.strip()
            if not stdout:
                stderr_msg = proc.stderr.strip() if proc.stderr else "no stderr"
                errors.append({"ingredient": ingredient.name, "error": f"empty output | stderr: {stderr_msg[:300]}"})
                continue

            # Script prints logs to stdout before the final JSON — find the last JSON object
            idx = stdout.rfind("\n{")
            json_str = stdout[idx:].strip() if idx != -1 else stdout
            payload = json.loads(json_str)

            if "error" in payload:
                errors.append({"ingredient": ingredient.name, "error": payload["error"]})
                continue

            rec = payload["recommendation"]
            expected_usage = float(rec["optimal_target_qty"])
            days = len(payload.get("chart_data", {}).get("forecast", []))

            # Derive upper/lower from summed daily forecast bounds
            forecast = payload.get("chart_data", {}).get("forecast", [])
            upper_bound = round(sum(d["likely_high_bound_95th"] for d in forecast), 2) if forecast else None
            lower_bound = round(sum(d["likely_low_bound_5th"] for d in forecast), 2) if forecast else None
            daily_target_average = round(expected_usage / days, 2) if days > 0 else None

            db.add(Predict(
                ingredient_id=ingredient.id,
                prediction_type=int(body.strategy),
                expected_usage=expected_usage,
                upper_bound=upper_bound,
                lower_bound=lower_bound,
                daily_target_average=daily_target_average,
                prediction_set=predict_set_id,
                restaurant_id=restaurant_id,
                timestamp=now,
            ))
            results.append({
                "ingredient_id": ingredient.id,
                "ingredient_name": ingredient.name,
                "expected_usage": expected_usage,
            })
        except subprocess.TimeoutExpired:
            errors.append({"ingredient": ingredient.name, "error": "timeout"})
        except Exception as e:
            errors.append({"ingredient": ingredient.name, "error": str(e)})

    db.commit()
    return {
        "message": "success",
        "Data": {
            "predict_set_id": predict_set_id,
            "total_processed": len(results),
            "predictions": results,
            "errors": errors,
        },
    }


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
            Predict.expected_usage, Predict.upper_bound, Predict.lower_bound,
            Predict.daily_target_average, Ingredient.unit,
            case((Ingredient.stock_left >= Predict.expected_usage, 1), else_=0).label("status"),
        )
        .join(Predict, Predict.ingredient_id == Ingredient.id)
        .join(latest_sub, (Predict.ingredient_id == latest_sub.c.ingredient_id)
              & (Predict.timestamp == latest_sub.c.latest_time))
        .filter(Predict.restaurant_id == restaurant_id, Ingredient.is_active == 1)
        .all()
    )
    return {"message": "success", "Data": [
        {
            "ingredient_id": r[0], "ingredient_name": r[1], "current_stock": float(r[2]),
            "expected_usage": float(r[3]),
            "upper_bound": float(r[4]) if r[4] is not None else None,
            "lower_bound": float(r[5]) if r[5] is not None else None,
            "daily_target_average": float(r[6]) if r[6] is not None else None,
            "unit": r[7], "status": r[8],
        }
        for r in rows
    ]}


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
                "timestamp": str(r[0]),
                "expected_usage": float(r[1]),
                "upper_bound": float(r[2]) if r[2] is not None else None,
                "lower_bound": float(r[3]) if r[3] is not None else None,
                "daily_target_average": float(r[4]) if r[4] is not None else None,
            }
            for r in rows
        ],
    }}