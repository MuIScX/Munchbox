from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.db import get_db
from app.core.security import decode_token
from app.schemas.menu import (
    MenuCreate, MenuUpdate, MenuDelete, MenuDetailRequest,
    RecipeAdd, RecipeEdit, RecipeDelete, RecipeDetailRequest,
)
from app.models.menu import Menu, Recipe
from app.models.ingredient import Ingredient

menu_router   = APIRouter(prefix="/api/menu",   tags=["Menu"])
recipe_router = APIRouter(prefix="/api/recipe", tags=["Recipe"])


def _query_menus(db: Session, restaurant_id: int, menu_id: int = None):
    q = (
        db.query(
            Menu.id,
            Menu.name,
            Menu.type,
            func.count(Recipe.ingredient_id).label("ingredient_count"),
            case(
                (func.sum(case((Ingredient.stock_left < Recipe.amount, 1), else_=0)) == 0, 1),
                else_=0,
            ).label("readiness"),
            Menu.price,
        )
        .outerjoin(Recipe, Menu.id == Recipe.menu_id)
        .outerjoin(Ingredient, Recipe.ingredient_id == Ingredient.id)
        .filter(Menu.restaurant_id == restaurant_id, Menu.is_active == 1)
        .group_by(Menu.id, Menu.name, Menu.type, Menu.price)
    )
    if menu_id is not None:
        q = q.filter(Menu.id == menu_id)
    return [
        {"menu_id": r[0], "menu_name": r[1], "type": r[2],
         "ingredient_count": r[3], "readiness": r[4], "price": r[5]}
        for r in q.all()
    ]


# ── Menu ──────────────────────────────────────────────────────────────────────

@menu_router.post("/list")
def get_all_menu(identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    return {"message": "success", "Data": _query_menus(db, identity["restaurantId"])}


@menu_router.post("/create", status_code=201)
def add_menu(body: MenuCreate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    menu = Menu(name=body.name, price=body.price, type=body.type, restaurant_id=identity["restaurantId"])
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return {"message": "success", "Data": {"menu_id": menu.id}}


@menu_router.put("/update")
def update_menu(body: MenuUpdate, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    menu = db.query(Menu).filter(Menu.id == body.menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    if body.name  is not None: menu.name  = body.name
    if body.price is not None: menu.price = body.price
    if body.type  is not None: menu.type  = body.type
    db.commit()
    return {"message": "success", "Data": []}


@menu_router.delete("/delete")
def delete_menu(body: MenuDelete, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    menu = db.query(Menu).filter(Menu.id == body.menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    menu.is_active = 0
    db.commit()
    return {"message": "success", "Data": []}


@menu_router.post("/detail")
def get_menu_detail(body: MenuDetailRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    rows = _query_menus(db, identity["restaurantId"], body.menu_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Menu not found")
    return {"message": "success", "Data": rows[0]}


# ── Recipe ────────────────────────────────────────────────────────────────────

@recipe_router.post("/detail")
def get_recipe_detail(body: RecipeDetailRequest, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    rows = (
        db.query(Ingredient.id, Ingredient.name, Recipe.amount, Ingredient.unit)
        .join(Recipe, Recipe.ingredient_id == Ingredient.id)
        .filter(Recipe.menu_id == body.menu_id,
                Ingredient.restaurant_id == identity["restaurantId"],
                Ingredient.is_active == 1)
        .all()
    )
    return {"message": "success", "Data": [
        {"ingredient_id": r[0], "ingredient_name": r[1],
         "amount": float(r[2]) if r[2] else 0.0, "unit": r[3] or ""}
        for r in rows
    ]}


@recipe_router.post("/add", status_code=201)
def add_ingredient_to_menu(body: RecipeAdd, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    db.add(Recipe(restaurant_id=identity["restaurantId"],
                  menu_id=body.menu_id, ingredient_id=body.ingredient_id, amount=body.amount))
    db.commit()
    return {"message": "success", "Data": []}


@recipe_router.put("/edit")
def edit_ingredient_on_menu(body: RecipeEdit, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    recipe = db.query(Recipe).filter(Recipe.menu_id == body.menu_id,
                                     Recipe.ingredient_id == body.ingredient_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe entry not found")
    recipe.amount = body.amount
    db.commit()
    return {"message": "success", "Data": []}


@recipe_router.delete("/delete")
def delete_ingredient_from_menu(body: RecipeDelete, identity: dict = Depends(decode_token), db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.menu_id == body.menu_id,
                                     Recipe.ingredient_id == body.ingredient_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe entry not found")
    db.delete(recipe)
    db.commit()
    return {"message": "success", "Data": []}
