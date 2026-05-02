from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.security import decode_token, create_access_token
from app.schemas.staff import StaffCreate, StaffUpdate, StaffDelete, ManagerPinVerify, StaffLoginRequest, StaffSelfUpdate
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
    existing_name = db.query(Staff).filter(
        Staff.restaurant_id == identity["restaurantId"],
        Staff.name == body.name,
        Staff.is_active == 1,
    ).first()
    if existing_name:
        raise HTTPException(status_code=409, detail=f'"{body.name}" already exists.')
    existing_username = db.query(Staff).filter(
        Staff.restaurant_id == identity["restaurantId"],
        Staff.username == body.username,
        Staff.is_active == 1,
    ).first()
    if existing_username:
        raise HTTPException(status_code=409, detail=f'Username "{body.username}" is already taken.')
    staff = Staff(
        name=body.name,
        username=body.username,
        password=body.password,
        role=body.role,
        restaurant_id=identity["restaurantId"],
    )
    db.add(staff)
    db.commit()
    return {"message": "success", "Data": []}


@router.put("/update")
def edit_staff(body: StaffUpdate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(
        Staff.id == body.staff_id,
        Staff.restaurant_id == identity["restaurantId"],
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    caller_role = identity.get("role", 1)
    if caller_role == 1:
        pass  # Admin — can edit anyone
    elif caller_role == 2:
        if staff.role == 1:
            raise HTTPException(status_code=403, detail="Managers cannot edit Admin staff")
        if body.role == 1:
            raise HTTPException(status_code=403, detail="Managers cannot promote staff to Admin")
    else:
        raise HTTPException(status_code=403, detail="You do not have permission to edit staff")
    if body.name is not None:
        staff.name = body.name
    staff.role = body.role
    db.commit()
    return {"message": "success", "Data": []}


@router.delete("/delete")
def delete_staff(body: StaffDelete, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    if body.staff_id == identity.get("staffId"):
        raise HTTPException(status_code=403, detail="You cannot delete yourself")
    staff = db.query(Staff).filter(
        Staff.id == body.staff_id,
        Staff.restaurant_id == identity["restaurantId"],
    ).first()
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


@router.post("/login")
def staff_login(body: StaffLoginRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(
        Staff.username == body.username,
        Staff.restaurant_id == identity["restaurantId"],
        Staff.is_active == 1,
    ).first()
    if not staff:
        raise HTTPException(status_code=401, detail="Staff not found")
    if staff.password != body.password:
        raise HTTPException(status_code=401, detail="Wrong password")
    token = create_access_token({
        "staffId":      staff.id,
        "restaurantId": staff.restaurant_id,
        "name":         staff.name,
        "username":     staff.username,
        "role":         staff.role,
    })
    return {
        "message": "success",
        "token": token,
        "Data": {
            "staff_id": staff.id,
            "name": staff.name,
            "username": staff.username,
            "role": staff.role,
        },
    }


@router.put("/self-update")
def staff_self_update(body: StaffSelfUpdate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(
        Staff.id == body.staff_id,
        Staff.restaurant_id == identity["restaurantId"],
        Staff.is_active == 1,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if body.name is not None:
        staff.name = body.name

    if body.username is not None or body.new_password is not None:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if staff.password != body.current_password:
            raise HTTPException(status_code=401, detail="Incorrect current password")
        if body.username is not None:
            taken = db.query(Staff).filter(
                Staff.restaurant_id == identity["restaurantId"],
                Staff.username == body.username,
                Staff.is_active == 1,
                Staff.id != body.staff_id,
            ).first()
            if taken:
                raise HTTPException(status_code=409, detail="Username already taken")
            staff.username = body.username
        if body.new_password is not None:
            if body.new_password == body.current_password:
                raise HTTPException(status_code=400, detail="New password cannot be the same as current password")
            staff.password = body.new_password

    db.commit()
    db.refresh(staff)
    new_token = create_access_token({
        "staffId":      staff.id,
        "restaurantId": staff.restaurant_id,
        "name":         staff.name,
        "username":     staff.username,
        "role":         staff.role,
    })
    return {"message": "success", "token": new_token}
