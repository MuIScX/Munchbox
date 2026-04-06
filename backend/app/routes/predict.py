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
from app.schemas.report import PredictRecordRequest,PredictReportRequest, PredictIngredientRequest, PredictTrendRequest, PredictGenerateRequest, PredictSetsRequest, PrepSummaryRequest
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

@router.post("/sets")
def get_predict_sets(body: PredictSetsRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    """Return all predict_sets for an ingredient with their date ranges."""
    restaurant_id = identity["restaurantId"]

    rows = (
        db.query(
            Predict.prediction_set,
            func.min(Predict.timestamp).label("start_date"),
            func.max(Predict.timestamp).label("end_date"),
        )
        .filter(
            Predict.ingredient_id   == body.ingredient_id,
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 1,
        )
        .group_by(Predict.prediction_set)
        .order_by(Predict.prediction_set.desc())
        .all()
    )

    return {"message": "success", "Data": [
        {
            "predict_set_id": r[0],
            "start_date":     str(r[1].date()) if r[1] else None,
            "end_date":       str(r[2].date()) if r[2] else None,
        }
        for r in rows
    ]}


@router.post("/ingredient-forecast")
def get_ingredient_forecast(body: PredictIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    """Return daily forecast rows (prediction_type=1) from the specified or latest predict_set."""
    restaurant_id = identity["restaurantId"]

    # Use provided predict_set_id or fall back to latest
    if body.predict_set_id is not None:
        set_id = body.predict_set_id
    else:
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
        set_id = latest_set[0]

    rows = (
        db.query(
            Predict.timestamp,
            Predict.expected_usage,
            Predict.upper_bound,
            Predict.lower_bound,
        )
        .filter(
            Predict.ingredient_id   == body.ingredient_id,
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_set  == set_id,
            Predict.prediction_type == 1,
        )
        .order_by(Predict.timestamp.asc())
        .all()
    )

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
            "forecast_start":       str(rows[0].timestamp.date())  if rows else None,
            "forecast_end":         str(rows[-1].timestamp.date()) if rows else None,
        }

    # Step 4: Get daily_target_average from summary rows
    summary_rows = (
        db.query(Predict.ingredient_id, Predict.daily_target_average, Predict.prediction_set, Predict.urgency_score)
        .join(latest_set_sub, (latest_set_sub.c.ingredient_id == Predict.ingredient_id)
              & (latest_set_sub.c.latest_set == Predict.prediction_set))
        .filter(
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 2,
        )
        .all()
    )
    summary_map = {r.ingredient_id: {"daily_target_average": r.daily_target_average, "urgency_score": r.urgency_score} for r in summary_rows}

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

        total_usage   = agg["total_expected_usage"]
        summary       = summary_map.get(ing_id, {})
        daily_avg     = summary.get("daily_target_average")
        urgency_score = summary.get("urgency_score")

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
            "urgency_score":        urgency_score,
            "unit":                 ing.unit,
            "category":             ing.category,
            "status":               1 if float(ing.stock_left) >= total_usage else 0,
            "forecast_start":       agg["forecast_start"],
            "forecast_end":         agg["forecast_end"],
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

    # Build date filter
    date_filter = ""
    params = {"ingredient_id": body.ingredient_id, "restaurant_id": restaurant_id}

    if body.start_date:
        date_filter += " AND DATE(S.timestamp) >= :start_date"
        params["start_date"] = body.start_date
    if body.end_date:
        date_filter += " AND DATE(S.timestamp) <= :end_date"
        params["end_date"] = body.end_date

    rows = db.execute(
        text(f"""
            SELECT DATE(S.timestamp) AS date, SUM(S.amount * R.amount) AS daily_usage
            FROM sale_data S
            JOIN recipe R ON S.menu_id = R.menu_id
            WHERE R.ingredient_id = :ingredient_id
              AND S.restaurant_id  = :restaurant_id
              {date_filter}
            GROUP BY DATE(S.timestamp)
            ORDER BY date ASC
        """),
        params,
    ).fetchall()
    return {"message": "success", "Data": [
        {"date": str(r[0]), "actual_usage": float(r[1])} for r in rows
    ]}
@router.post("/prep-summary")
def prep_summary(body: PrepSummaryRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    """Return all active ingredients with expected_usage summed over the given date range (latest predict_set).
    Ingredients without prediction data in that range are included but marked has_data=False."""
    restaurant_id = identity["restaurantId"]

    ingredients = (
        db.query(Ingredient)
        .filter(Ingredient.restaurant_id == restaurant_id, Ingredient.is_active == 1)
        .all()
    )
    if not ingredients:
        return {"message": "success", "Data": []}

    ingredient_ids = [i.id for i in ingredients]

    # Calculate how many days the requested range spans
    from datetime import date as date_type
    if body.start_date and body.end_date:
        start_dt  = date_type.fromisoformat(body.start_date)
        end_dt    = date_type.fromisoformat(body.end_date)
        requested_days = (end_dt - start_dt).days + 1
    else:
        requested_days = None

    # Step 1: for every (ingredient, set) count how many type-1 rows fall in the requested range
    from collections import defaultdict
    counts_q = (
        db.query(
            Predict.ingredient_id,
            Predict.prediction_set,
            func.count(Predict.id).label("day_count"),
        )
        .filter(
            Predict.restaurant_id   == restaurant_id,
            Predict.prediction_type == 1,
            Predict.ingredient_id.in_(ingredient_ids),
        )
    )
    if body.start_date:
        counts_q = counts_q.filter(func.date(Predict.timestamp) >= body.start_date)
    if body.end_date:
        counts_q = counts_q.filter(func.date(Predict.timestamp) <= body.end_date)
    counts_q = counts_q.group_by(Predict.ingredient_id, Predict.prediction_set)

    # Step 2: per ingredient, keep only sets that FULLY cover the requested range,
    # then pick the newest (highest set id). If no set fully covers → no data.
    set_counts = defaultdict(list)
    for r in counts_q.all():
        set_counts[r.ingredient_id].append((r.day_count, r.prediction_set))

    best_sets = {}
    for ing_id, entries in set_counts.items():
        # Only consider sets that cover every day in the range
        if requested_days is not None:
            full_coverage = [e for e in entries if e[0] >= requested_days]
        else:
            full_coverage = entries  # no range filter — any set is fine
        if not full_coverage:
            continue  # no set covers the full range → will be marked no data
        # Among qualifying sets, pick the newest (highest set id)
        full_coverage.sort(key=lambda x: x[1], reverse=True)
        best_sets[ing_id] = {"set_id": full_coverage[0][1], "day_count": full_coverage[0][0]}

    # Step 3: sum expected_usage from the chosen set within the requested range
    # Also fetch urgency_score from the type-2 summary row (same source as /report endpoint)
    urgency_map = {}
    if best_sets:
        summary_rows = (
            db.query(Predict.ingredient_id, Predict.prediction_set, Predict.urgency_score)
            .filter(
                Predict.restaurant_id   == restaurant_id,
                Predict.prediction_type == 2,
                Predict.ingredient_id.in_(list(best_sets.keys())),
            )
            .all()
        )
        for sr in summary_rows:
            best = best_sets.get(sr.ingredient_id)
            if best and sr.prediction_set == best["set_id"]:
                urgency_map[sr.ingredient_id] = int(sr.urgency_score) if sr.urgency_score is not None else None

    pred_map = {}
    for ing_id, best in best_sets.items():
        agg_q = (
            db.query(func.sum(Predict.expected_usage))
            .filter(
                Predict.restaurant_id   == restaurant_id,
                Predict.prediction_type == 1,
                Predict.ingredient_id   == ing_id,
                Predict.prediction_set  == best["set_id"],
            )
        )
        if body.start_date:
            agg_q = agg_q.filter(func.date(Predict.timestamp) >= body.start_date)
        if body.end_date:
            agg_q = agg_q.filter(func.date(Predict.timestamp) <= body.end_date)
        total = agg_q.scalar()
        if total is not None:
            pred_map[ing_id] = {"total_expected": float(total), "day_count": best["day_count"], "urgency_score": urgency_map.get(ing_id)}

    result = []
    for ing in ingredients:
        pred = pred_map.get(ing.id)
        if pred:
            total  = round(pred["total_expected"], 2)
            status = 1 if float(ing.stock_left) >= total else 0
            result.append({
                "ingredient_id":   ing.id,
                "ingredient_name": ing.name,
                "current_stock":   float(ing.stock_left),
                "expected_usage":  total,
                "day_count":       pred["day_count"],
                "unit":            ing.unit,
                "category":        ing.category,
                "urgency_score":   pred.get("urgency_score"),
                "status":          status,
                "has_data":        True,
            })
        else:
            result.append({
                "ingredient_id":   ing.id,
                "ingredient_name": ing.name,
                "current_stock":   float(ing.stock_left),
                "expected_usage":  None,
                "day_count":       0,
                "unit":            ing.unit,
                "category":        ing.category,
                "status":          None,
                "has_data":        False,
            })

    return {"message": "success", "Data": result}


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