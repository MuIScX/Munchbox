from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.security import decode_token
from app.schemas.staff import StaffCreate, StaffUpdate, StaffDelete, ManagerPinVerify
from app.models.staff import Staff
from app.models.restaurant import RestaurantInfo

router = APIRouter(prefix="/api/staff", tags=["Staff"])


@router.post("/list")
def get_all_staff(identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    rows = db.query(Staff).filter(
        Staff.restaurant_id == identity["restaurantId"],
        Staff.is_active == 1,
    ).all()
    return {"message": "success", "Data": [
        {"staff_id": s.id, "name": s.name, "role": s.role} for s in rows
    ]}


@router.post("/create", status_code=201)
def add_staff(body: StaffCreate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    staff = Staff(name=body.name, role=body.role, restaurant_id=identity["restaurantId"])
    db.add(staff)
    db.commit()
    return {"message": "success", "Data": []}


@router.put("/update")
def edit_staff(body: StaffUpdate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == body.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    if body.name is not None:
        staff.name = body.name
    if body.role is not None:
        staff.role = body.role
    db.commit()
    return {"message": "success", "Data": []}


@router.delete("/delete")
def delete_staff(body: StaffDelete, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == body.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.is_active = 0
    db.commit()
    return {"message": "success", "Data": []}


@router.post("/verify-manager-pin")
def verify_manager_pin(body: ManagerPinVerify, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    restaurant = db.query(RestaurantInfo).filter(RestaurantInfo.id == identity["restaurantId"]).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if restaurant.manager_pin is None or restaurant.manager_pin != body.pin:
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return {"message": "success"}
