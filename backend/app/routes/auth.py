from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.security import create_access_token, decode_token
from app.schemas.auth import LoginRequest, RegisterRequest
from app.models.user import User

router = APIRouter(prefix="/api", tags=["Auth"])


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.password != body.password:
        raise HTTPException(status_code=401, detail="Wrong password")
    token = create_access_token({
        "userId":       user.id,
        "username":     user.username,
        "restaurantId": user.restaurant_id,
        "permission":   user.permission,
    })
    return {"message": "success", "token": token}


@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        username=body.username,
        restaurant_id=body.restaurant_id,
        email=body.email,
        password=body.password,
    )
    db.add(user)
    db.commit()
    return {"message": "success"}


@router.get("/user/me")
def get_current_user(
    identity: dict = Depends(decode_token),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == identity["userId"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "message": "success",
        "Data": {
            "id":            user.id,
            "username":      user.username,
            "email":         user.email,
            "permission":    user.permission,
            "restaurant_id": user.restaurant_id,
        },
    }