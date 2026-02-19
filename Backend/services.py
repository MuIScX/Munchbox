from database import Database
db_config = {
    'host': '127.0.0.1',	
    'port': 3306,
    'user': 'root',
    'password': 'Music468@',
    'database': 'munchbox',
}
db = Database(db_config)

class Callback: 
    def __init__(self, Message,Data):
        self.Message = Message  
        self.Data = Data

class Service:
    
    def login(email,password):

        if not email:
            return Callback("Missing argument: email", [])
        if not password:
            return Callback("Missing argument: password", [])
        
        if password == db.Q_password(email):
            data =  db.Q_Login(email)
            return Callback("success", data )
        else:
            return Callback("Failed to login", [] )
        
    def register(username, restaurant_id, email, password):
        
        if not username:
            return Callback("Missing argument: username", [])
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        if not email:
            return Callback("Missing argument: email", [])
        
        if not password:
            return Callback("Missing argument: password", [])
        
        results = db.E_Register(username, restaurant_id, email, password)

        if not results:
            return Callback("register failed", [])
        
        else:
            return Callback("success", [])
            

# --------------------------
# Staff Service
# --------------------------

    def get_all_staff(restaurant_id):
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_AllStaffNameAndRole(restaurant_id)

        if not data:
            return Callback("No staff found", [])

        return Callback("success", data)

    def add_staff(name, role, restaurant_id):
        if not name:
            return Callback("Missing argument: name", [])
        
        if not role:
            return Callback("Missing argument: role", [])
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        result = db.E_AddNewStaff(name, role, restaurant_id)

        if not result:
            return Callback("Failed to add staff", [])

        return Callback("success", [])

    def edit_staff(staff_id, name=None, role=None):

        if not staff_id:
            return Callback("Missing argument: staff_id", [])

        if name is None and role is None:
            return Callback("No data provided", [])

        result = db.E_EditStaff(staff_id, name, role)

        if not result:
            return Callback("Nothing updated", [])

        return Callback("success", [])

    def delete_staff(staff_id):

        if not staff_id:
            return Callback("Missing argument: staff_id", [])

        result = db.E_DeleteStaff(staff_id)

        if not result:
            return Callback("Delete failed", [])

        return Callback("success", [])

    
# --------------------------
# Ingredient
# --------------------------    

    def get_all_ingredient(restaurant_id, menu_id=None, ingredient_id=None, category=None):
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetAllIngredient(
            restaurant_id,
            menu_id,
            ingredient_id,
            category
        )

        if not data:
            return Callback("No ingredient found", [])

        return Callback("success", data)


    def add_ingredient(restaurant_id, name, unit, category):
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        if not name:
            return Callback("Missing argument: name", [])
        
        if not unit:
            return Callback("Missing argument: unit", [])
        
        if not category:
            return Callback("Missing argument: category", [])
        
        result = db.E_AddNewIngredient(
            restaurant_id,
            name,
            unit,
            category
        )

        if not result:
            return Callback("Failed to add ingredient", [])

        return Callback("success", [])


    def update_ingredient_stock(restaurant_id, ingredient_id, new_stock, staff_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])
        
        if not new_stock:
            return Callback("Missing argument: new_stock", [])
        
        if not staff_id:
            return Callback("Missing argument: staff_id", [])

        result = db.E_UpdateIngredientStock(
            restaurant_id,
            ingredient_id,
            new_stock,
            staff_id
        )

        if not result:
            return Callback("Stock update failed", [])

        return Callback("success", [])


    def get_ingredient_status(restaurant_id, ingredient_id=None):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetIngredientStatus(
            restaurant_id,
            ingredient_id
        )

        if not data:
            return Callback("No status found", [])

        return Callback("success", data)


    def get_inventory_log(restaurant_id, ingredient_id=None): #TODO ทำให้รับ ingredient id ได้
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetInventoryLog(restaurant_id, ingredient_id)

        if not data:
            return Callback("No log found", [])

        return Callback("success", data)


    # def get_ingredient_name(restaurant_id, ingredient_id):
        
    #     if not restaurant_id:
    #         return Callback("Missing restaurant_id", [])

    #     data = db.Q_GetIngredientNameById(
    #         restaurant_id,
    #         ingredient_id
    #     )

    #     if not data:
    #         return Callback("Ingredient not found", [])

    #     return Callback("success", data)

# --------------------------
# Menu
# --------------------------   

    def get_all_menu(restaurant_id):
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetMenuDetails(restaurant_id)

        if not data:
            return Callback("No menu found", [])

        return Callback("success", data)
    
    def add_menu(restaurant_id, name, price, type):
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        if not name:
            return Callback("Missing argument: name", [])
        
        if not price:
            return Callback("Missing argument: price", [])
        
        if not type:
            return Callback("Missing argument: type", [])

        result = db.E_AddNewMenu(restaurant_id, name, price, type)

        if not result:
            return Callback("Failed to add menu", [])

        return Callback("success", [])

    def delete_menu(menu_id):

        if not menu_id:
            return Callback("Missing argument: menu_id", [])

        result = db.E_DeleteMenu(menu_id)

        if not result:
            return Callback("Delete failed", [])
        
        return Callback("success", [])
    
    def update_menu_details(menu_id, menu_name=None, menu_price=None, menu_type=None):

        if not menu_id:
            return Callback("Missing argument: menu_id", [])
        
        fields = []
        if menu_name:
            fields.append(menu_name)
        if menu_price:
            fields.append(menu_price)
        if menu_type:
            fields.append(menu_type)

        if not fields:
            return Callback("No argument for updating", [])
        
        result = db.E_EditMenuDetails(menu_id, menu_name, menu_price, menu_type)
        
        if not result:
            return Callback("Update failed", [])
        
        return Callback("success", [])


# --------------------------
# Recipe
# --------------------------

    def add_ingredient_to_menu(restaurant_id, menu_id, ingredient_id, amount):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        if not menu_id:
            return Callback("Missing argument: menu_id", [])
        
        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])
        
        if not amount:
            return Callback("Missing argument: amount", [])

        if amount <= 0:
            return Callback("Invalid amount", [])

        result = db.E_AddIngredientToMenu(restaurant_id, menu_id, ingredient_id, amount)
        
        if not result:
            return Callback("Failed to add ingredient to menu", [])

        return Callback("success", [])
    
    def edit_ingredient_on_menu(menu_id, ingredient_id, amount):

        if not menu_id:
            return Callback("Missing argument: menu_id", [])
        
        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])
        
        if not amount:
            return Callback("Missing argument: amount", [])

        if amount <= 0:
            return Callback("Invalid amount", [])

        result = db.E_EditIngredientOnMenu(menu_id, ingredient_id, amount)

        if not result:
            return Callback("Failed to update ingredient", [])

        return Callback("success", [])
    
    def delete_ingredient_from_menu(menu_id, ingredient_id):

        if not menu_id:
            return Callback("Missing argument: menu_id", [])
        
        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])

        result = db.E_DeleteIngredientFromMenu(menu_id, ingredient_id)

        if not result:
            return Callback("Failed to delete ingredient", [])

        return Callback("success", [])
    
# --------------------------
# Sale Record
# --------------------------

    def record_sale(restaurant_id, items):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        total_item = 0
        success_count = 0

        if not items:
            return Callback("success", {
                "total_item": 0
            })

        for item in items:
            menu_id = item.get("menu_id")
            amount = item.get("amount")

            if not menu_id or amount is None:
                continue

            result = db.E_RecordSale(
                restaurant_id,
                menu_id,
                amount
            )

            if result:
                total_item += amount
                success_count += 1

        return Callback("success", {
            "menu_recorded": success_count,
            "total_item": total_item
        })

# --------------------------
# Report
# --------------------------

    def get_revenue_by_menu(restaurant_id, menu_id=None):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        data = db.Q_GetRevenueByMenu(restaurant_id, menu_id)

        if not data:
            return Callback("No revenue data", [])
        
        return Callback("success", data)
    
    def get_total_orders_by_menu(restaurant_id, menu_id=None):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        data = db.Q_GetTotalOrdersByMenu(restaurant_id, menu_id)

        if not data:
            return Callback("No order data", [])
        
        return Callback("success", data)

    def get_share_by_menu(restaurant_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        data = db.Q_GetShareByMenu(restaurant_id)
        
        if not data:
            return Callback("No share data", [])

        return Callback("success", data)

    def get_share_by_catagory(restaurant_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        data = db.Q_GetAllShareByCategory(restaurant_id)

        if not data:
            return Callback("No category data", [])
        
        return Callback("success", data)

    def get_menu_trend(restaurant_id, menu_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        if not menu_id:
            return Callback("Missing argument: menu_id", [])
        
        data = db.Q_GetMenuTrend(restaurant_id, menu_id)
        
        if not data:
            return Callback("No sales record available", [])
        
        return Callback("success", data)

    def get_total_order_per_day(restaurant_id, menu_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        if not menu_id:
            return Callback("Missing argument: menu_id", [])
            
        data = db.E_GetTotalOrderPerday(restaurant_id, menu_id)

        if not data:
            return Callback("No daily order data", [])
        
        return Callback("success", data)
    
    def get_ingredient_trend(restaurant_id, ingredient_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])

        data = db.E_GetIngredientTrend(restaurant_id, ingredient_id)

        if not data:
            return Callback("No ingredient trend data", [])

        return Callback("success", data)
        
# --------------------------
# MunchBox
# --------------------------

    def send_update_menu_name(restaurant_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        data = db.Q_SendUpdateMenuName(restaurant_id,)
        
        if not data:
            return Callback("No menu name available", [])
        
        return Callback("success", data)
    
# --------------------------
# Predict
# --------------------------

    def get_predicted_report(restaurant_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetPredictedReport(restaurant_id)
        
        if not data:
            return  Callback("No predicted report found", [])
        
        return Callback("success", data)

    def record_predict(predict_set_id, restaurant_id, predictions):

        if not predict_set_id:
            return Callback("Missing argument: predict_set_id", [])
        
        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        if not predictions:
            return Callback("Missing argument: predictions", [])

        result = db.E_RecordPredict(predict_set_id, restaurant_id, predictions)

        if not result:
            return Callback("Failed to record prediction", [])

        return Callback("Prediction recorded", [])
    
    def get_predicted_ingredient(restaurant_id, ingredient_id=None):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetPredictedIngredient(restaurant_id, ingredient_id)

        if not data:
            return Callback("No prediction found", [])

        return Callback("success", data)
    

    def get_predicted_status(restaurant_id, ingredient_id=None):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        data = db.Q_GetPredictedStatus(restaurant_id, ingredient_id)

        if not data:
            return Callback("No predicted status found", [])

        return Callback("success", data)
    

    def get_predicted_trend(restaurant_id, ingredient_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])

        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])

        data = db.Q_GetPredictedTrend(restaurant_id, ingredient_id)

        if not data:
            return Callback("No trend data found", [])

        return Callback("success", data)
       
    def get_predicted_by_ingredient_id(restaurant_id, ingredient_id):

        if not restaurant_id:
            return Callback("Missing argument: restaurant_id", [])
        
        if not ingredient_id:
            return Callback("Missing argument: ingredient_id", [])

        data = db.Q_GetPredictedByIngredientId(restaurant_id, ingredient_id)

        if not data:
            return Callback("No prediction found", [])

        return Callback("success", data)