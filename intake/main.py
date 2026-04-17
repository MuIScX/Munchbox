from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from auth import verify_api_key

from app.models.sale import SaleData
from app.models.menu import Menu


# --- Helpers ---
def _query_menus(db: Session, restaurant_id: int):
    menus = db.query(Menu).filter(
        Menu.restaurant_id == restaurant_id,
        Menu.is_active == 1,
    ).all()
    return [
        {
            "menu_id": m.id,
            "menu_name": m.name,
            "type": m.type,
            "price": m.price,
        }
        for m in menus
    ]

app = FastAPI(title="Munchbox Intake API")


# --- Schemas ---
class SaleItem(BaseModel):
    menu_id: int
    amount: int

class ExternalSaleRequest(BaseModel):
    restaurant_id: int
    sale_date: Optional[str] = None  # "YYYY-MM-DD", omit for today
    items: List[SaleItem]


# --- Endpoints ---
@app.post("/receive")
def receive_sale(
    body: ExternalSaleRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    total_item = 0
    success_count = 0

    if body.sale_date:
        dt = datetime.strptime(body.sale_date, "%Y-%m-%d")
        timestamp = datetime(dt.year, dt.month, dt.day)
    else:
        timestamp = datetime.utcnow()

    for item in body.items:
        if item.amount <= 0:
            continue
        menu = db.query(Menu).filter(
            Menu.id == item.menu_id,
            Menu.restaurant_id == body.restaurant_id,
            Menu.is_active == 1,
        ).first()
        if not menu:
            continue
        db.add(SaleData(
            timestamp=timestamp,
            amount=item.amount,
            menu_id=item.menu_id,
            restaurant_id=body.restaurant_id,
        ))
        total_item += item.amount
        success_count += 1

    db.commit()
    return {
        "message": "success",
        "data": {
            "menu_recorded": success_count,
            "total_item": total_item
        }
    }


class MenuListRequest(BaseModel):
    restaurant_id: int

@app.post("/menu/list")
def get_menu_list(
    body: MenuListRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    return {"message": "success", "Data": _query_menus(db, body.restaurant_id)}


@app.get("/health")
def health():
    return {"status": "healthy"}