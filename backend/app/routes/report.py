from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.core.security import decode_token
from app.schemas.report import ReportMenuRequest, ReportIngredientRequest
from app.models.sale import SaleData
from app.models.menu import Menu, Recipe

router = APIRouter(prefix="/api/report", tags=["Report"])


@router.post("/revenue")
def get_revenue(body: ReportMenuRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    q = (
        db.query(SaleData.menu_id, func.sum(SaleData.amount * Menu.price).label("revenue"))
        .join(Menu, SaleData.menu_id == Menu.id)
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(SaleData.menu_id)
    )
    if body.menu_id is not None:
        q = q.filter(SaleData.menu_id == body.menu_id)
    return {"message": "success", "Data": [{"menu_id": r[0], "revenue": float(r[1])} for r in q.all()]}


@router.post("/orders")
def get_total_orders(body: ReportMenuRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    q = (
        db.query(SaleData.menu_id, func.sum(SaleData.amount).label("total_orders"))
        .join(Menu, SaleData.menu_id == Menu.id)
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(SaleData.menu_id)
    )
    if body.menu_id is not None:
        q = q.filter(SaleData.menu_id == body.menu_id)
    return {"message": "success", "Data": [{"menu_id": r[0], "total_orders": int(r[1])} for r in q.all()]}


@router.post("/share/menu")
def get_share_menu(identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant_id = identity["restaurantId"]
    total_sub = (
        db.query(func.sum(SaleData.amount))
        .filter(SaleData.restaurant_id == restaurant_id)
        .scalar_subquery()
    )
    rows = (
        db.query(
            Menu.id, Menu.name,
            func.coalesce(func.sum(SaleData.amount), 0),
            func.coalesce(func.sum(SaleData.amount * Menu.price), 0),
            (func.coalesce(func.sum(SaleData.amount), 0) / func.coalesce(total_sub, 1) * 100),
        )
        .outerjoin(SaleData, (Menu.id == SaleData.menu_id) & (SaleData.restaurant_id == restaurant_id))
        .filter(Menu.restaurant_id == restaurant_id)
        .group_by(Menu.id, Menu.name, Menu.price)
        .all()
    )
    return {"message": "success", "Data": [
        {"menu_id": r[0], "menu_name": r[1], "total_orders": int(r[2]),
         "revenue": int(r[3]), "share_percent": round(float(r[4]), 2)}
        for r in rows
    ]}


@router.post("/share/category")
def get_share_category(identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    rows = (
        db.query(Menu.type, func.sum(SaleData.amount).label("total_order"))
        .join(Menu, SaleData.menu_id == Menu.id)
        .filter(SaleData.restaurant_id == identity["restaurantId"])
        .group_by(Menu.type)
        .all()
    )
    return {"message": "success", "Data": [{"type": r[0], "total_order": int(r[1] or 0)} for r in rows]}


@router.post("/trend/menu")
def get_menu_trend(body: ReportMenuRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    rows = (
        db.query(func.date(SaleData.timestamp).label("day"), func.sum(SaleData.amount))
        .filter(SaleData.restaurant_id == identity["restaurantId"], SaleData.menu_id == body.menu_id)
        .group_by(func.date(SaleData.timestamp))
        .order_by("day")
        .all()
    )
    return {"message": "success", "Data": [{"day": str(r[0]), "sale_amount": int(r[1] or 0)} for r in rows]}


@router.post("/trend/ingredient")
def get_ingredient_trend(body: ReportIngredientRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    rows = (
        db.query(
            func.date(SaleData.timestamp).label("day"),
            func.sum(SaleData.amount * Recipe.amount).label("amount_used"),
        )
        .join(Recipe, SaleData.menu_id == Recipe.menu_id)
        .filter(SaleData.restaurant_id == identity["restaurantId"],
                Recipe.ingredient_id == body.ingredient_id)
        .group_by(func.date(SaleData.timestamp))
        .order_by("day")
        .all()
    )
    return {"message": "success", "Data": [body.ingredient_id,
            [{"day": str(r[0]), "amount_used": float(r[1])} for r in rows]]}
