"""
Prediction scheduler — runs the Bayesian forecast automatically for each
restaurant that has a prediction_frequency set.

Frequency is stored as an integer: number of days between runs.
A value of None (or 0) means manual-only — no scheduled job.

The forecast window is always: tomorrow → (tomorrow + frequency - 1 days).
"""

import logging
from datetime import datetime, timedelta, time as dt_time

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

bkk = pytz.timezone("Asia/Bangkok")

from app.db import SessionLocal
from app.models.restaurant import RestaurantInfo
from app.models.ingredient import Ingredient
from app.services.forecaster import run_forecast_job

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Bangkok")


def _run_predictions_for_restaurant(restaurant_id: int, days_ahead: int):
    """Called by APScheduler. Runs forecast for all active ingredients."""
    logger.info(f"[scheduler] Running predictions for restaurant {restaurant_id} ({days_ahead} days ahead)")
    db = SessionLocal()
    try:
        tomorrow = (datetime.today() + timedelta(days=1)).strftime("%Y-%m-%d")
        end_date = (datetime.today() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

        ingredients = db.query(Ingredient).filter(
            Ingredient.restaurant_id == restaurant_id,
            Ingredient.is_active == 1,
        ).all()

        for ingredient in ingredients:
            try:
                payload = run_forecast_job(
                    restaurant_id=restaurant_id,
                    sell_price=150.0,
                    buy_price=100.0,
                    start_date=tomorrow,
                    end_date=end_date,
                    strategy="2",
                    ingredient_name=ingredient.name,
                    ingredient_id=ingredient.id,
                    save_to_db=True,
                    return_chart=True,
                )
                if "error" in payload:
                    logger.warning(f"[scheduler] {ingredient.name}: {payload['error']}")
                else:
                    logger.info(f"[scheduler] {ingredient.name}: OK")
            except Exception as e:
                logger.error(f"[scheduler] {ingredient.name}: {e}")
    finally:
        db.close()


def _job_id(restaurant_id: int) -> str:
    return f"predict_restaurant_{restaurant_id}"


def _next_run_start(run_time: dt_time) -> datetime:
    """Return the next datetime (BKK) that matches run_time. If today's time hasn't passed yet, use today; otherwise tomorrow."""
    now = datetime.now(bkk)
    candidate = bkk.localize(datetime(now.year, now.month, now.day, run_time.hour, run_time.minute, 0))
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def schedule_restaurant(restaurant_id: int, frequency_days: int | None, days_ahead: int = 7, run_time: dt_time = dt_time(0, 0)):
    """Add or replace the scheduled job for a restaurant."""
    job_id = _job_id(restaurant_id)

    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    if not frequency_days or frequency_days <= 0:
        logger.info(f"[scheduler] Restaurant {restaurant_id}: auto-prediction disabled")
        return

    start = _next_run_start(run_time)
    scheduler.add_job(
        _run_predictions_for_restaurant,
        trigger=IntervalTrigger(days=frequency_days, start_date=start, timezone=bkk),
        id=job_id,
        args=[restaurant_id, days_ahead],
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info(f"[scheduler] Restaurant {restaurant_id}: every {frequency_days} day(s) at {run_time.strftime('%H:%M')} BKK, {days_ahead} days ahead, first run {start}")


def load_all_schedules():
    """Called on startup — load schedules for all restaurants."""
    db = SessionLocal()
    try:
        restaurants = db.query(RestaurantInfo).all()
        for r in restaurants:
            if r.prediction_frequency and r.prediction_frequency > 0:
                schedule_restaurant(r.id, r.prediction_frequency, r.prediction_days_ahead or 7, r.prediction_run_time or dt_time(0, 0))
    finally:
        db.close()


def start():
    scheduler.start()
    load_all_schedules()
    logger.info("[scheduler] APScheduler started")


def get_next_run(restaurant_id: int) -> str | None:
    """Return the next scheduled run time as an ISO string, or None if not scheduled."""
    job = scheduler.get_job(_job_id(restaurant_id))
    if job and job.next_run_time:
        return job.next_run_time.isoformat()
    return None


def stop():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[scheduler] APScheduler stopped")
