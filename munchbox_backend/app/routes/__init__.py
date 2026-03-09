from fastapi import FastAPI
from app.routes.auth       import router as auth_router
from app.routes.staff      import router as staff_router
from app.routes.ingredient import router as ingredient_router
from app.routes.menu       import menu_router, recipe_router
from app.routes.sale       import router as sale_router
from app.routes.report     import router as report_router
from app.routes.predict    import router as predict_router
from app.routes.munchbox   import router as munchbox_router
from app.routes.restaurant import router as restaurant_router


def register_routes(app: FastAPI):
    app.include_router(auth_router)
    app.include_router(staff_router)
    app.include_router(ingredient_router)
    app.include_router(menu_router)
    app.include_router(recipe_router)
    app.include_router(sale_router)
    app.include_router(report_router)
    app.include_router(predict_router)
    app.include_router(munchbox_router)
    app.include_router(restaurant_router)