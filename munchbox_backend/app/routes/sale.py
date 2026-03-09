from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app.core.security import decode_token
from app.schemas.report import SaleRecordRequest
from app.models.sale import SaleData
from app.models.menu import Menu

router = APIRouter(prefix="/api/sale", tags=["Sale"])


@router.post("/record")
def record_sale(body: SaleRecordRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant_id = identity["restaurantId"]
    total_item = 0
    success_count = 0

    for item in body.items:
        if item.amount <= 0:
            continue
        menu = db.query(Menu).filter(
            Menu.id == item.menu_id,
            Menu.restaurant_id == restaurant_id,
            Menu.is_active == 1,
        ).first()
        if not menu:
            continue
        db.add(SaleData(
            timestamp=datetime.utcnow(),
            amount=item.amount,
            menu_id=item.menu_id,
            restaurant_id=restaurant_id,
        ))
        total_item += item.amount
        success_count += 1

    db.commit()
    return {"message": "success", "Data": {"menu_recorded": success_count, "total_item": total_item}}
