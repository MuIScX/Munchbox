from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime

from app.db import get_db
from app.core.security import decode_token
from app.schemas.ingredient import (
    IngredientListRequest, IngredientCreate, IngredientStockUpdate,
    IngredientStatusRequest, IngredientLogRequest, IngredientDelete,
)
from app.models.ingredient import Ingredient, IngredientHistory
from app.models.menu import Recipe
from app.models.staff import Staff
from app.models.predict import Predict

router = APIRouter(prefix="/api/ingredient", tags=["Ingredient"])


@router.post("/list")
def get_ingredients(body: IngredientListRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    q = db.query(Ingredient).filter(
        Ingredient.restaurant_id == identity["restaurantId"],
        Ingredient.is_active == 1,
    )
    if body.menu_id is not None:
        q = q.join(Recipe, Recipe.ingredient_id == Ingredient.id).filter(Recipe.menu_id == body.menu_id)
    if body.ingredient_id is not None:
        q = q.filter(Ingredient.id == body.ingredient_id)
    if body.category is not None:
        q = q.filter(Ingredient.category == body.category)

    return {"message": "success", "Data": [
        {"id": i.id, "ingredient_name": i.name, "category": i.category,
         "stock_left": float(i.stock_left), "unit": i.unit}
        for i in q.all()
    ]}


@router.post("/create", status_code=201)
def add_ingredient(body: IngredientCreate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    ingredient = Ingredient(
        restaurant_id=identity["restaurantId"],
        name=body.name,
        unit=body.unit,
        category=body.category,
        stock_left=0,
        last_update=datetime.utcnow(),
    )
    db.add(ingredient)
    db.commit()
    return {"message": "success", "Data": []}


@router.put("/update-stock")
def update_stock(body: IngredientStockUpdate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == body.ingredient_id,
        Ingredient.restaurant_id == identity["restaurantId"],
        Ingredient.is_active == 1,
    ).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    current = float(ingredient.stock_left)
    new_stock = float(body.new_stock)
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Invalid stock value")
    if new_stock == current:
        return {"message": "No change", "Data": []}

    try:
        action_type = 1 if new_stock > current else 2
        ingredient.stock_left = new_stock
        ingredient.last_update = datetime.utcnow()
        db.add(IngredientHistory(
            timestamp=datetime.utcnow(),
            action_type=action_type,
            amount=abs(new_stock - current),
            ingredient_id=body.ingredient_id,
            staff_id=body.staff_id,
            restaurant_id=identity["restaurantId"],
            new_current=int(new_stock),
        ))
        db.commit()
        return {"message": "success", "Data": []}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/status")
def get_ingredient_status(body: IngredientStatusRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    latest_sub = (
        db.query(Predict.ingredient_id, func.max(Predict.timestamp).label("latest_time"))
        .filter(Predict.restaurant_id == identity["restaurantId"])
        .group_by(Predict.ingredient_id)
        .subquery()
    )
    q = (
        db.query(
            Ingredient.id,
            case(
                (Ingredient.stock_left < Predict.amount_need, 0),
                (Ingredient.stock_left < Predict.amount_need * 1.2, 1),
                else_=2,
            ).label("status"),
        )
        .join(Predict, Ingredient.id == Predict.ingredient_id)
        .join(latest_sub, (Predict.ingredient_id == latest_sub.c.ingredient_id)
              & (Predict.timestamp == latest_sub.c.latest_time))
        .filter(Ingredient.restaurant_id == identity["restaurantId"], Ingredient.is_active == 1)
    )
    if body.ingredient_id is not None:
        q = q.filter(Ingredient.id == body.ingredient_id)

    return {"message": "success", "Data": [{"ingredient_id": r[0], "status": r[1]} for r in q.all()]}


@router.post("/log")
def get_inventory_log(body: IngredientLogRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    q = (
        db.query(
            IngredientHistory.timestamp,
            IngredientHistory.action_type,
            IngredientHistory.ingredient_id,
            Ingredient.name,
            IngredientHistory.amount,
            IngredientHistory.staff_id,
            Staff.name,
            Ingredient.unit,
            IngredientHistory.new_current,
        )
        .join(Staff, IngredientHistory.staff_id == Staff.id)
        .join(Ingredient, IngredientHistory.ingredient_id == Ingredient.id)
        .filter(IngredientHistory.restaurant_id == identity["restaurantId"])
    )
    if body.ingredient_id is not None:
        q = q.filter(IngredientHistory.ingredient_id == body.ingredient_id)

    return {"message": "success", "Data": [
        {
            "timestamp": r[0], "action_type": r[1], "ingredient_id": r[2],
            "ingredient_name": r[3], "amount": float(r[4]),
            "staff_id": r[5], "staff_name": r[6], "unit": r[7], "new_current": r[8],
        }
        for r in q.order_by(IngredientHistory.timestamp.desc()).all()
    ]}


@router.delete("/delete")
def delete_ingredient(body: IngredientDelete, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    ingredient = db.query(Ingredient).filter(Ingredient.id == body.ingredient_id).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    ingredient.is_active = 0
    db.commit()
    return {"message": "success", "Data": []}
