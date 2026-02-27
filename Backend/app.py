from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,get_jwt,get_jwt_header
)
from datetime import timedelta
from services import Service,Callback


app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = "b4c6022b4baed3f901fed7343576428e16bfa17d"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=744)
jwt = JWTManager(app)
CORS(app)

@app.post("/api/login")
def login():
    post = request.json
    print(post)
    email = post["email"]
    password = post["password"]
    text = ""
    print(email)
    data = []
    if email and password:
        result = Service.login(email,password)
        text = result.Message
        data = result.Data
        if data:
            print(data)
            user_identity = {
                "userId": data["id"],
                "username": data["username"],
                "restaurantId": data["restaurant_id"],
                "permission": data["permission"]
            }
            token = create_access_token(identity=json.dumps(user_identity))
            return jsonify({"message": text, "token": token}), 200
        return jsonify({"message": text}), 401
    return jsonify({"message": text}), 401

@app.post("/api/register")
def register():
    post = request.get_json(force=True)
    print(post)
    username = post.get("username")
    restaurant_id = post.get("restaurant_id")
    email = post.get("email")
    password = post.get("password")

    result = Service.register(username, restaurant_id, email, password)
    status = 201 if "success" in result.Message.lower() else 400
    return jsonify({"message": result.Message, "Data": result.Data}), status


@app.post("/api/staff/list")
@jwt_required()
def get_all_staff():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    print(identity)
    restaurantId = identity["restaurantId"]
    result = Service.get_all_staff(restaurantId)
    return jsonify({"message": result.Message, "Data": result.Data}), 200


@app.post("/api/staff/create")
@jwt_required()
def add_staff():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.json
    name = post.get("name")
    role = post.get("role")
    print(post)
    result = Service.add_staff(name, role, restaurantId)
    return jsonify({"message": result.Message, "Data": result.Data}), 201

@app.put("/api/staff/update")
@jwt_required()
def edit_staff():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    # restaurantId = identity["restaurantId"] 

    post = request.get_json(force=True)
    staff_id = post.get("staff_id")
    name = post.get("name")
    role = post.get("role")

    result = Service.edit_staff(staff_id, name, role)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.delete("/api/staff/delete")
@jwt_required()
def delete_staff():
    identity = get_jwt_identity()
    identity = json.loads(identity)

    post = request.get_json(force=True)
    staff_id = post.get("staff_id")

    result = Service.delete_staff(staff_id)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

# --------------------------
# Ingredient API
# --------------------------

@app.post("/api/ingredient/list")
@jwt_required()
def get_ingredients():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.get_all_ingredient(
        restaurant_id=restaurantId,
        menu_id=post.get("menu_id"),
        ingredient_id=post.get("ingredient_id"),
        category=post.get("category")
    )

    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/ingredient/create")
@jwt_required()
def add_ingredient():
    identity = json.loads(get_jwt_identity())
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.add_ingredient(
        restaurant_id=restaurantId,
        name=post.get("name"),
        unit=post.get("unit"),
        category=post.get("category")
    )
    return jsonify({"message": result.Message, "Data": result.Data}), 201

@app.put("/api/ingredient/update-stock")
@jwt_required()
def update_stock():
    identity = json.loads(get_jwt_identity())
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    print(post)
    result = Service.update_ingredient_stock(
        restaurant_id=restaurantId,
        ingredient_id=post.get("ingredient_id"),
        new_stock=post.get("new_stock"),
        staff_id=post.get("staff_id")
    )
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/ingredient/status")
@jwt_required()
def get_ingredient_status():
    identity = json.loads(get_jwt_identity())
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.get_ingredient_status(restaurantId, post.get("ingredient_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/ingredient/log")
@jwt_required()
def get_inventory_log():
    identity = get_jwt_identity()
    identity = json.loads(identity)  
    restaurantId = identity["restaurantId"]
    post = request.get_json(force=True)

    result = Service.get_inventory_log(restaurantId,post.get("ingredient_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

# --------------------------
# Menu API
# --------------------------

@app.post("/api/menu/list")
@jwt_required()
def get_all_menu():
    identity = get_jwt_identity()
    identity = json.loads(identity)  
    restaurantId = identity["restaurantId"]
    
    result = Service.get_all_menu(restaurantId)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/menu/create")
@jwt_required()
def add_menu():
    identity = get_jwt_identity()
    identity = json.loads(identity)  
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.add_menu(
        restaurant_id=restaurantId,
        name=post.get("name"),
        price=post.get("price"),
        type=post.get("type")
    )
    return jsonify({"message": result.Message, "Data": result.Data}), 201

@app.put("/api/menu/update")
@jwt_required()
def update_menu_details():
    post = request.get_json(force=True)
    result = Service.update_menu_details(
        menu_id=post.get("menu_id"),
        menu_price=post.get("price"),
        menu_type=post.get("type"),
        menu_name=post.get("name")
        
    )
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.delete("/api/menu/delete")
@jwt_required()
def delete_menu():
    post = request.get_json(force=True)
    result = Service.delete_menu(menu_id=post.get("menu_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200




# --------------------------
# Recipe API
# --------------------------

@app.post("/api/recipe/add")
@jwt_required()
def add_ingredient_to_menu():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    menu_id = post.get("menu_id")
    ingredient_id = post.get("ingredient_id")
    amount = post.get("amount")
    
    result = Service.add_ingredient_to_menu(restaurantId, menu_id, ingredient_id, amount)
    return jsonify({"message": result.Message, "Data": result.Data}), 201

@app.put("/api/recipe/edit")
@jwt_required()
def edit_ingredient_on_menu():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    
    post = request.get_json(force=True)
    menu_id = post.get("menu_id")
    ingredient_id = post.get("ingredient_id")
    amount = post.get("amount")
    
    result = Service.edit_ingredient_on_menu(menu_id, ingredient_id, amount)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.delete("/api/recipe/delete")
@jwt_required()
def delete_ingredient_from_menu():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    
    post = request.get_json(force=True)
    menu_id = post.get("menu_id")
    ingredient_id = post.get("ingredient_id")
    
    result = Service.delete_ingredient_from_menu(menu_id, ingredient_id)
    return jsonify({"message": result.Message, "Data": result.Data}), 200


# --------------------------
# Sale API z
# --------------------------

@app.post("/api/sale/record")
@jwt_required()
def record_sale():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    items = post.get("items", []) # รับเป็น list ของ menu_id และ amount
    
    result = Service.record_sale(restaurantId, items)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

# --------------------------
# Report API
# --------------------------

@app.post("/api/report/revenue")
@jwt_required()
def get_revenue():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.get_revenue_by_menu(restaurantId, post.get("menu_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/report/orders")
@jwt_required()
def get_total_orders():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.get_total_orders_by_menu(restaurantId, post.get("menu_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/report/share/menu")
@jwt_required()
def get_share_menu():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    result = Service.get_share_by_menu(restaurantId)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/report/share/category")
@jwt_required()
def get_share_category():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    result = Service.get_share_by_catagory(restaurantId)
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/report/trend/menu")
@jwt_required()
def get_menu_trend():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.get_menu_trend(restaurantId, post.get("menu_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

@app.post("/api/report/trend/ingredient")
@jwt_required()
def get_ingredient_trend():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]
    
    post = request.get_json(force=True)
    result = Service.get_ingredient_trend(restaurantId, post.get("ingredient_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

# --------------------------
# MunchBox API
# --------------------------

@app.post("/api/munchbox/update-menu")
def send_update_menu():
    
    post = request.get_json(force=True)
    
    result = Service.send_update_menu_name(post.get("restaurant_id"))
    return jsonify({"message": result.Message, "Data": result.Data}), 200

# --------------------------
# Predict
# --------------------------

@app.post("/api/predict/report")
@jwt_required()
def predicted_report():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]

    result = Service.get_predicted_report(restaurantId)

    return jsonify({"message": result.Message,"Data": result.Data}), 200

@app.post("/api/predict/trend")
@jwt_required()
def predicted_trend():
    identity = get_jwt_identity()
    identity = json.loads(identity)
    restaurantId = identity["restaurantId"]

    post = request.get_json(force=True)
    ingredient_id = post.get("ingredient_id")

    result = Service.get_predicted_trend(restaurantId, ingredient_id)

    return jsonify({"message": result.Message, "Data": result.Data}), 200



#-----------------------------

if __name__ == "__main__":
    app.run(debug=True)
