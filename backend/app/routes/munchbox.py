from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.report import MunchBoxUpdateRequest
from app.models.menu import Menu

router = APIRouter(prefix="/api/munchbox", tags=["MunchBox"])


@router.post("/update-menu")
def send_update_menu(body: MunchBoxUpdateRequest, db: Session = Depends(get_db)):
    rows = db.query(Menu.id, Menu.name).filter(
        Menu.restaurant_id == body.restaurant_id,
        Menu.is_active == 1,
    ).all()
    return {"message": "success", "Data": [{"menu_id": r[0], "menu_name": r[1]} for r in rows]}
