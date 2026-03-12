from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date

from app.db import get_db
from app.core.security import decode_token
from app.schemas.report import ReportMenuRequest, ReportIngredientRequest
from app.models.sale import SaleData
from app.models.menu import Menu, Recipe
from pydantic import BaseModel

router = APIRouter(prefix="/api/report", tags=["Report"])


class ReportMenuRequestWithDate(BaseModel):
    menu_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ReportIngredientRequestWithDate(BaseModel):
    ingredient_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None


def apply_date_filter(q, body):
    if hasattr(body, "start_date") and body.start_date:
        q = q.filter(SaleData.timestamp >= body.start_date)
    if hasattr(body, "end_date") and body.end_date:
        q = q.filter(SaleData.timestamp <= body.end_date)
    return q


@router.post("/revenue")
def get_revenue(
    body: ReportMenuRequestWithDate,
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    q = (
        db.query(SaleData.menu_id, func.sum(SaleData.amount * Menu.price).label("revenue"))
        .join(Menu, SaleData.menu_id == Menu.id)
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(SaleData.menu_id)
    )
    if body.menu_id is not None:
        q = q.filter(SaleData.menu_id == body.menu_id)
    q = apply_date_filter(q, body)
    return {"message": "success", "Data": [{"menu_id": r[0], "revenue": float(r[1])} for r in q.all()]}


@router.post("/orders")
def get_total_orders(
    body: ReportMenuRequestWithDate,
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    q = (
        db.query(SaleData.menu_id, func.sum(SaleData.amount).label("total_orders"))
        .join(Menu, SaleData.menu_id == Menu.id)
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(SaleData.menu_id)
    )
    if body.menu_id is not None:
        q = q.filter(SaleData.menu_id == body.menu_id)
    q = apply_date_filter(q, body)
    return {"message": "success", "Data": [{"menu_id": r[0], "total_orders": int(r[1])} for r in q.all()]}


@router.post("/share/menu")
def get_share_menu(
    body: ReportMenuRequestWithDate,  # ← NOW HAS BODY
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    restaurant_id = identity["restaurantId"]

    # Total with date filter
    total_q = (
        db.query(func.sum(SaleData.amount))
        .filter(SaleData.restaurant_id == restaurant_id)
    )
    total_q = apply_date_filter(total_q, body)
    total_sub = total_q.scalar_subquery()

    sale_q = (
        db.query(
            Menu.id, Menu.name,
            func.coalesce(func.sum(SaleData.amount), 0),
            func.coalesce(func.sum(SaleData.amount * Menu.price), 0),
            (func.coalesce(func.sum(SaleData.amount), 0) / func.coalesce(total_sub, 1) * 100),
        )
        .outerjoin(SaleData, (Menu.id == SaleData.menu_id) & (SaleData.restaurant_id == restaurant_id))
        .filter(Menu.restaurant_id == restaurant_id)
    )
    sale_q = apply_date_filter(sale_q, body)
    rows = sale_q.group_by(Menu.id, Menu.name, Menu.price).all()

    return {"message": "success", "Data": [
        {"menu_id": r[0], "menu_name": r[1], "total_orders": int(r[2]),
         "revenue": int(r[3]), "share_percent": round(float(r[4]), 2)}
        for r in rows
    ]}


@router.post("/share/category")
def get_share_category(
    body: ReportMenuRequestWithDate,  # ← NOW HAS BODY
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Menu.type, func.sum(SaleData.amount).label("total_order"))
        .join(Menu, SaleData.menu_id == Menu.id)
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(Menu.type)
    )
    q = apply_date_filter(q, body)
    rows = q.all()
    return {"message": "success", "Data": [{"type": r[0], "total_order": int(r[1] or 0)} for r in rows]}


@router.post("/trend/menu")
def get_menu_trend(
    body: ReportMenuRequestWithDate,
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    q = (
        db.query(func.date(SaleData.timestamp).label("day"), func.sum(SaleData.amount))
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(func.date(SaleData.timestamp))
        .order_by("day")
    )
    if body.menu_id is not None:
        q = q.filter(SaleData.menu_id == body.menu_id)
    q = apply_date_filter(q, body)
    return {"message": "success", "Data": [{"day": str(r[0]), "sale_amount": int(r[1] or 0)} for r in q.all()]}


@router.post("/trend/ingredient")
def get_ingredient_trend(
    body: ReportIngredientRequestWithDate,
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    q = (
        db.query(
            func.date(SaleData.timestamp).label("day"),
            func.sum(SaleData.amount * Recipe.amount).label("amount_used"),
        )
        .join(Recipe, SaleData.menu_id == Recipe.menu_id)
        .filter(
            SaleData.restaurant_id == identity["restaurantId"],
            Recipe.ingredient_id == body.ingredient_id,
        )
        .group_by(func.date(SaleData.timestamp))
        .order_by("day")
    )
    q = apply_date_filter(q, body)
    return {"message": "success", "Data": [body.ingredient_id,
            [{"day": str(r[0]), "amount_used": float(r[1])} for r in q.all()]]}