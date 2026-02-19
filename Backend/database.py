# database.py
import pymysql

db_config = {
    'host': '127.0.0.1',	
    'port': 3306,
    'user': 'root',
    'password': 'Music468@',
    'database': 'munchbox',
}

class Database:
    def __init__(self, config):
        try:
            self.connection = pymysql.connect(**config)
            self.cursor = self.connection.cursor()
            print("Database Connected")
        except pymysql.MySQLError as e:
            print(f"Error connecting to MySQL: {e}")
            self.connection = None
            self.cursor = None
    # Close connection to database
    def close(self):
        if self.connection:
            self.cursor.close()
            self.connection.close()
            print("Database Connection Closed")

    # Query function
    def query(self, query, params=None):
        self.cursor.execute(query, params)
        return self.cursor.fetchall()

    # Execute function
    def execute(self, query, params=None):
        """
        For:    
            1. UPDATE
        """
        self.cursor.execute(query, params)
        self.connection.commit()

## ------------------------------------------------------- ##
# Data access
    
    def Q_AllStaffNameAndRole(self,resturant_id):
        query = 'SELECT id,name,role FROM staff WHERE restaurant_id = %s '
        param = (resturant_id,)
        rows = self.query(query,param)
        result = []
        for row in rows:
            result.append({
                "staff_id": row[0],
                "name": row[1],
                "role": row[2]
            })
        return result

    def E_AddNewStaff(self, name, role, restaurant_id):
        query = """
        INSERT INTO Staff (name, role, restaurant_id)
        VALUE (%s, %s, %s)
        """
        param = (name, role, restaurant_id)
        self.execute(query, param)
        return True
    

    def E_EditStaff(self, staff_id, name=None, role=None):
        fields = []
        params = []

        if name is not None:
            fields.append("name = %s")
            params.append(name)

        if role is not None:
            fields.append("role = %s")
            params.append(role)

        if not fields:
            return False

        query = f"UPDATE Staff SET {', '.join(fields)} WHERE id = %s"
        params.append(staff_id)

        self.execute(query, tuple(params))
        return True

    def E_DeleteStaff(self, staff_id):
        query = """
        UPDATE Staff 
        SET is_active = 0
        WHERE id = %s
        """
        param = (staff_id,)
        self.execute(query, param)
        return True

    def Q_GetPredictedReport(self, restaurant_id):
        query = """
            SELECT 
                i.id AS ingredientId,
                i.name AS ingredientName,
                i.stock_left AS currentStock,
                p.amount_need AS amountNeed,
                i.unit,
                CASE 
                    WHEN i.stock_left < p.amount_need THEN 0
                    ELSE 1
                END AS status
            FROM Predict p
            JOIN Ingredient i 
                ON p.ingredient_id = i.id
            JOIN (
                SELECT ingredient_id, MAX(timestamp) AS latest_time
                FROM Predict
                WHERE restaurant_id = %s
                GROUP BY ingredient_id
            ) latest
                ON p.ingredient_id = latest.ingredient_id
                AND p.timestamp = latest.latest_time
            WHERE p.restaurant_id = %s
        """

        params = (restaurant_id, restaurant_id)
        rows = self.query(query, params)

        result = []
        for row in rows:
            result.append({
                "ingredient_id": row[0],
                "ingredient_name": row[1],
                "current_stock": float(row[2]),
                "amount_need": float(row[3]),
                "unit": row[4],
                "status": row[5]
            })

        return result
    
    # TODO
    # def E_CreatePredictSet(self, prediction_id):
    #     query = """
    #         INSERT INTO Predict_set (prediction_id, timestamp)
    #         VALUES (%s, NOW())
    #     """

    #     self.execute(query, (prediction_id,))

    #     # Get newly created id
    #     predict_set_id = self.get_last_insert_id()

    #     return predict_set_id
    
    def E_RecordPredict(self, predict_set_id, restaurant_id, predictions):
        query = """
            INSERT INTO Predict (
                ingredient_id,
                prediction_type,
                amount_need,
                prediction_set,
                restaurant_id,
                timestamp
            )
            VALUES (%s, %s, %s, %s, %s, NOW())
        """
        for item in predictions:
            params = (
                item["ingredient_id"],
                item["prediction_type"],
                item["amount_need"],
                predict_set_id,
                restaurant_id
            )
            self.execute(query, params)

        return True


    def Q_GetPredictedIngredient(self, restaurant_id, ingredient_id=None):
        """
        get the ingredient's predicted need  
        return JSON[{ingredientId, predictionType, amountNeed}] 
        """
        query = """
        SELECT 
            ingredient_id, 
            prediction_type, 
            amount_need
        FROM Predict
        WHERE restaurant_id = %s
        """
        params = [restaurant_id]
        
        # If a specific ingredient is requested, append the filter
        if ingredient_id is not None:
            query += " AND ingredient_id = %s"
            params.append(ingredient_id)

        # Execute and return (assuming your self.query returns a list of dicts)
        rows = self.query(query, tuple(params))
        result = []
        for row in rows:
            result.append({
                "ingredient_id": row[0],
                "prediction_type":row[1],
                "amount_need": row[2]
            })
        return result 

    def Q_GetIngredientStatus(self, restaurant_id, ingredient_id=None): 
        # get all or one ingredient status (reorder, ok, warning)
        # return JSON[{ingredientId, status}]

        # Logic: 
        # 0 : reorder: stock < amount_need
        # 1 : warning: stock is close (e.g., less than 120% of need)
        # 2 : ok: stock is well above need
    
        query = """
        SELECT 
            Ingredient.id,
            CASE 
                WHEN Ingredient.stock_left < Predict.amount_need THEN 0
                WHEN Ingredient.stock_left < (Predict.amount_need * 1.2) THEN 1
                ELSE 2
            END AS status
        FROM Ingredient
        INNER JOIN Predict 
            ON Ingredient.id = Predict.ingredient_id
        INNER JOIN (
            SELECT ingredient_id, MAX(timestamp) AS latest_time
            FROM Predict
            GROUP BY ingredient_id
        ) latest
            ON Predict.ingredient_id = latest.ingredient_id
            AND Predict.timestamp = latest.latest_time
        WHERE Ingredient.restaurant_id = %s
        """
        params = [restaurant_id]

        if ingredient_id is not None:
            query += " AND Ingredient.id = %s"
            params.append(ingredient_id)

        rows = self.query(query, tuple(params))
        result = []
        for row in rows:
            result.append({
                "ingredient_id": row[0],
                "status": row[1]
            })
        return result

    def Q_GetAllIngredient(self, restaurant_id, menu_id=None, ingredient_id=None, category=None):
        query = """
            SELECT 
                i.id,
                i.name,
                i.category,
                i.stock_left,
                i.unit
            FROM Ingredient i
        """

        conditions = ["i.restaurant_id = %s"]
        params = [restaurant_id]

        if menu_id is not None:
            query += " JOIN Recipe r ON i.id = r.ingredient_id"
            conditions.append("r.menu_id = %s")
            params.append(menu_id)

        if ingredient_id is not None:
            conditions.append("i.id = %s")
            params.append(ingredient_id)

        if category is not None:
            conditions.append("i.category = %s")
            params.append(category)

        query += " WHERE " + " AND ".join(conditions)

        rows = self.query(query, tuple(params))
        result = []
        for row in rows:
            result.append({
                "id": row[0],
                "ingredient_name": row[1],
                "category": row[2],
                "stock_left": row[3],
                "unit": row[4]
            })
        return result

    def Q_GetPredictedTrend(self, restaurant_id, ingredient_id):
        query = """
            SELECT p.timestamp, p.amount_need, p.ingredient_id

            FROM Predict p

             JOIN (

                SELECT DATE(timestamp) as pred_date, MAX(timestamp) as max_ts

                FROM Predict

                WHERE ingredient_id = %s AND restaurant_id = %s

                GROUP BY DATE(timestamp)

            ) latest ON p.timestamp = latest.max_ts
            WHERE p.ingredient_id = %s AND restaurant_id = %s
            ORDER BY p.timestamp ASC;
        """

        params = (ingredient_id, restaurant_id, ingredient_id, restaurant_id)
        rows = self.query(query, params)

        trend_list = []
        for row in rows:
            trend_list.append({
                "timestamp": row[0],
                "amount_need": float(row[1])
            })

        return {
            "ingredient_id": ingredient_id,
            "data": trend_list
        }
    
    def E_GetIngredientTrend(self, restaurant_id, ingredient_id):
        query = """
            SELECT 
                DATE(s.timestamp) AS day,
                SUM(s.amount * r.amount) AS amountUsed
            FROM Sale_data s
            JOIN Recipe r 
                ON s.menu_id = r.menu_id
            WHERE s.restaurant_id = %s
            AND r.ingredient_id = %s
            GROUP BY DATE(s.timestamp)
            ORDER BY day ASC
        """

        params = (restaurant_id, ingredient_id)
        rows = self.query(query, params)

        trend_data = []
        for row in rows:
            trend_data.append({
                "day": row[0],
                "amount_used": float(row[1])
            })

        return [ingredient_id, trend_data]


    def E_GetTotalOrderPerday(self, restaurant_id, menu_id):
        query = """
            SELECT 
                DATE(timestamp) AS day,
                SUM(amount) AS totalOrder
            FROM Sale_data
            WHERE restaurant_id = %s
            AND menu_id = %s
            GROUP BY DATE(timestamp)
            ORDER BY day ASC
        """

        params = (restaurant_id, menu_id)
        rows = self.query(query, params)

        order_data = []
        for row in rows:
            order_data.append({
                "day": row[0],
                "order": int(row[1])
            })

        return (menu_id, order_data)

    def Q_GetMenuDetails(self, restaurant_id, menu_id=None): 
        # get all the menu with its details
        # return JSON[{menuId, menuName, type, ingredientCount, readiness, price}]  
        query = """
        SELECT 
            Menu.id AS menuId, 
            Menu.name AS menuName, 
            Menu.type AS type, 
            COUNT(Recipe.ingredient_id) AS ingredientCount,
            CASE 
                WHEN SUM(CASE WHEN Ingredient.stock_left <= 0 THEN 1 ELSE 0 END) = 0 
                AND COUNT(Recipe.ingredient_id) > 0 THEN 1
                ELSE 0
            END AS readiness,
            Menu.price AS price
        FROM Menu
        LEFT JOIN Recipe ON Menu.id = Recipe.menu_id
        LEFT JOIN Ingredient ON Recipe.ingredient_id = Ingredient.id
        WHERE Menu.restaurant_id = %s
        """
        params = [restaurant_id]

        # Add optional menu_id filter
        if menu_id is not None:
            query += " AND Menu.id = %s"
            params.append(menu_id)

        # Must include GROUP BY for aggregate functions (COUNT/SUM)
        query += " GROUP BY Menu.id, Menu.name, Menu.type, Menu.price;"

        rows = self.query(query, tuple(params))
        
        result = []
        for row in rows:
            result.append({
                "menu_id": row[0],
                "menu_name": row[1],
                "type": row[2],
                "ingredient_count": row[3],
                "readiness": row[4],
                "price": row[5]
            })
        return result

    def Q_GetAllMenuReadiness(self, restaurant_id):

        query = """
            SELECT 
                menu.id AS menuId,
                CASE 
                    WHEN COUNT(
                        CASE 
                            WHEN ingredient.stock_left < recipe.amount 
                            THEN 1 
                        END
                    ) > 0 
                    THEN 0
                    ELSE 1
                END AS readiness
            FROM Menu
            JOIN recipe 
                ON menu.id = recipe.menu_id
            JOIN ingredient 
                ON recipe.ingredient_id = ingredient.id
            WHERE menu.restaurant_id = %s
            GROUP BY menu.id
        """
        rows = self.query(query, (restaurant_id,))
        result = []
        for row in rows:
            result.append({
                "menu_id": row[0],
                "readiness": row[1]
            })
        return result

    def E_AddNewMenu(self, restaurant_id, menu_name, price, type):

        query = """
            INSERT INTO menu (name, price, type, restaurant_id)
            VALUES (%s, %s, %s, %s)
        """
        self.execute(query, (menu_name, price, type, restaurant_id))
        return True

    def E_DeleteMenu(self, menu_id):
        query = """
        UPDATE Menu
        SET is_active = 0
        WHERE id = %s
        """
        param = (menu_id,)
        self.execute(query, param)
        return True
    

    def E_AddIngredientToMenu(self, restaurant_id, menu_id, ingredient_id, amount):

        self.execute(
            "SELECT 1 FROM menu WHERE id=%s AND restaurant_id=%s",
            (menu_id, restaurant_id)
        )

        query = """
            INSERT INTO Recipe (restaurant_id, menu_id, ingredient_id, amount)
            VALUES ( %s,%s, %s, %s)
        """
        param = (restaurant_id, menu_id, ingredient_id, amount)

        self.execute(query, param)
        
        return True

    def E_DeleteIngredientFromMenu(self, menu_id, ingredient_id):
        
        query = """
            DELETE FROM recipe
            WHERE menu_id = %s
            AND ingredient_id = %s
        """

        param = (menu_id, ingredient_id)

        self.execute(query, param)
        
        return True

    def E_EditIngredientOnMenu(self, menu_id, ingredient_id, amount):

        query = """
            UPDATE recipe
            SET amount = %s
            WHERE menu_id = %s
            AND ingredient_id = %s
        """

        param = (amount, menu_id, ingredient_id)

        self.execute(query, param)
        
        return True

    def E_EditMenuDetails(self, menu_id, menu_name=None, menu_price=None, menu_type=None):
        fields = []
        params = []

        if menu_name is not None:
            fields.append("name = %s")
            params.append(menu_name)

        if menu_price is not None:
            fields.append("price = %s")
            params.append(menu_price)

        if menu_type is not None:
            fields.append("type = %s")
            params.append(menu_type)

        if not fields:
            return False  # Nothing to update
        
        query = f"UPDATE Menu SET {', '.join(fields)} WHERE id = %s"
        params.append(menu_id)

        self.execute(query, tuple(params))

        return True


    def E_UpdateIngredientStock(self, restaurant_id, ingredient_id, new_stock, staff_id):

        check_query = """
            SELECT stock_left
            FROM Ingredient
            WHERE id = %s AND restaurant_id = %s
        """
        row = self.query(check_query, (ingredient_id, restaurant_id))

        if not row:
            return False

        currentStock = float(row[0][0])

        # 2️⃣ Prevent invalid stock
        if new_stock < 0:
            return False

        # 3️⃣ If no change, stop
        if new_stock == currentStock:
            return True

        # 4️⃣ Determine action automatically
        if new_stock > currentStock:
            actionType = 1  # Add
            amountChange = new_stock - currentStock
        else:
            actionType = 2  # Deduct
            amountChange = currentStock - new_stock

        # 5️⃣ Use transaction (important)
        try:
            self.connection.begin()

            # Update stock
            update_query = """
                UPDATE Ingredient
                SET stock_left = %s,
                    last_update = NOW()
                WHERE id = %s
                AND restaurant_id = %s
            """
            self.execute(update_query, (new_stock, ingredient_id, restaurant_id))

            # Insert history
            insert_query = """
                INSERT INTO Ingredient_History
                (timestamp, action_type, amount, ingredient_id, staff_id, restaurant_id)
                VALUES (NOW(), %s, %s, %s, %s, %s)
            """
            self.execute(insert_query, (
                actionType,
                amountChange,
                ingredient_id,
                staff_id,
                restaurant_id
            ))

            self.connection.commit()
            return True

        except:
            self.connection.rollback()
            return False

    def Q_GetPredictedByIngredientId(self, restaurant_id, ingredient_id):

        query = """
            SELECT 
                ingredient_id,
                amount_need
            FROM Predict
            WHERE ingredient_id = %s
            AND restaurant_id = %s
        """
        param = (ingredient_id, restaurant_id)
        rows = self.query(query, param)
        result = []
        for row in rows:
            result.append({
                "ingredient_id": row[0],
                "amount_need": row[1]
            })
        return result

    def E_AddNewIngredient(self, restaurant_id, ingredient_name, unit, category):

        query = """
            INSERT INTO Ingredient (restaurant_id, name, unit, category, stock_left, last_update)
            VALUES (%s, %s, %s, %s, 0, NOW())
        """

        param = (restaurant_id, ingredient_name, unit, category)

        self.execute(query, param)

        return True
    
    def Q_GetPredictedStatus(self, restaurant_id, ingredient_id=None):
        condition = []
        params = [restaurant_id, restaurant_id]

        base_query = """
            SELECT 
                p.id,
                p.ingredient_id,
                i.name,
                p.amount_need,
                i.stock_left,
                CASE 
                    WHEN i.stock_left < p.amount_need THEN 0
                    WHEN i.stock_left = p.amount_need THEN 1
                    ELSE 2
                END AS predicted_status
            FROM Predict p
            JOIN Ingredient i 
                ON p.ingredient_id = i.id
            JOIN (
                SELECT ingredient_id, restaurant_id, MAX(timestamp) AS latest_time
                FROM Predict
                WHERE restaurant_id = %s
                GROUP BY ingredient_id, restaurant_id
            ) latest
                ON p.ingredient_id = latest.ingredient_id
                AND p.restaurant_id = latest.restaurant_id
                AND p.timestamp = latest.latest_time
            WHERE p.restaurant_id = %s
        """

        if ingredient_id is not None:
            condition.append("p.ingredient_id = %s")
            params.append(ingredient_id)

        if condition:
            base_query += " AND " + " AND ".join(condition)

        rows = self.query(base_query, tuple(params))
        result = []
        for row in rows:
            result.append({
                "id": row[0],
                "ingredient_id": row[1],
                "name": row[2],
                "amount_need": row[3],
                "stock_left": row[4],
                "status": row[5]
            })
        return result


    def Q_GetUpdatedInventoryById(self, restaurant_id, ingredient_id):

        query = """
            SELECT 
                id AS ingredientId,
                stock_left AS stockLeft
            FROM ingredient
            WHERE id = %s
            AND restaurant_id = %s
        """

        param = (ingredient_id, restaurant_id)

        rows = self.query(query, param)
        result = []
        for row in rows:
            result.append({
                "ingredient_id": row[0],
                "stock_left": row[1]
            })
        return result


    def Q_GetInventoryLog(self, restaurant_id, ingredient_id=None):
        # Base query joining history with staff and ingredient names
        query = """
            SELECT 
                Ingredient_History.timestamp,
                Ingredient_History.action_type,
                Ingredient_History.ingredient_id,
                Ingredient.name,
                Ingredient_History.amount,
                Ingredient_History.staff_id,
                Staff.name
            FROM Ingredient_History
            JOIN Staff ON Ingredient_History.staff_id = Staff.id
            JOIN Ingredient ON Ingredient_History.ingredient_id = Ingredient.id
            WHERE Ingredient_History.restaurant_id = %s
        """
        params = [restaurant_id]

        # Dynamically add the ingredient filter if provided
        if ingredient_id is not None:
            query += " AND Ingredient_History.ingredient_id = %s"
            params.append(ingredient_id)

        query += " ORDER BY Ingredient_History.timestamp DESC"

        # Convert params list to a tuple for the DB driver
        rows = self.query(query, tuple(params))
        
        result = []
        for row in rows:
            result.append({
                "timestamp": row[0],
                "action_type": row[1],
                "ingredient_id": row[2],
                "ingredient_name": row[3],
                "amount": row[4],
                "staff_id": row[5],
                "staff_name": row[6]
            })
        return result


    def Q_GetRevenueByMenu(self, restaurant_id, menu_id=None):
        query = """
            SELECT 
                s.menu_id,
                SUM(s.amount * m.price) AS revenue
            FROM Sale_data s
            JOIN Menu m ON s.menu_id = m.id
            WHERE s.restaurant_id = %s
        """

        params = [restaurant_id]

        if menu_id is not None:
            query += " AND s.menu_id = %s"
            params.append(menu_id)

        query += " GROUP BY s.menu_id"

        rows = self.query(query, tuple(params))

        result = []
        for row in rows:
            result.append({
                "menu_id": row[0],
                "revenue": float(row[1])
            })

        return result


    def Q_GetTotalOrdersByMenu(self, restaurant_id, menu_id=None):
        query = """
            SELECT 
                menu_id,
                SUM(amount) AS totalOrders
            FROM Sale_data
            WHERE restaurant_id = %s
        """

        params = [restaurant_id]

        if menu_id is not None:
            query += " AND menu_id = %s"
            params.append(menu_id)

        query += " GROUP BY menu_id"

        rows = self.query(query, tuple(params))

        result = []
        for row in rows:
            result.append({
                "menu_id": row[0],
                "total_orders": int(row[1])
            })

        return result

    def Q_GetShareByMenu(self, restaurant_id):
        query = """
            SELECT 
                m.id,
                m.name,
                IFNULL(SUM(s.amount), 0) AS totalOrders,
                (
                    IFNULL(SUM(s.amount), 0) /
                    (
                        SELECT IFNULL(SUM(amount), 1)
                        FROM Sale_data
                        WHERE restaurant_id = %s
                    )
                ) * 100 AS sharePercent
            FROM Menu m
            LEFT JOIN Sale_data s 
                ON m.id = s.menu_id 
                AND s.restaurant_id = %s
            WHERE m.restaurant_id = %s
            GROUP BY m.id, m.name
        """

        rows = self.query(query, (restaurant_id, restaurant_id, restaurant_id))

        result = []
        for row in rows:
            result.append({
                "menu_id": row[0],
                "menu_name": row[1],
                "total_orders": int(row[2]),
                "share_percent": round(float(row[3]), 2)
            })

        return result


    def Q_GetAllShareByCategory(self, restaurant_id):

        query = """
            SELECT 
                m.type,
                SUM(s.amount) AS totalOrder
            FROM Sale_data s
            JOIN Menu m ON s.menu_id = m.id
            WHERE s.restaurant_id = %s
            GROUP BY m.type
        """

        rows = self.query(query, (restaurant_id))

        return [
            {
                "type": row[0],
                "total_order": int(row[1] or 0)
            }
            for row in rows
        ]

    def Q_GetMenuTrend(self, restaurant_id, menu_id):

        query = """
            SELECT 
                DATE(timestamp) AS day,
                SUM(amount) AS saleAmount
            FROM Sale_data
            WHERE restaurant_id = %s
            AND menu_id = %s
            GROUP BY DATE(timestamp)
            ORDER BY day ASC
        """

        rows = self.query(query, (restaurant_id, menu_id))

        return [
            {
                "day": row[0],
                "sale_amount": int(row[1] or 0)
            }
            for row in rows
        ]
    
    def E_RecordSale(self, restaurant_id, menu_id, sale_amount):
        if sale_amount <= 0:
            return False

        # check menu belongs to restaurant
        check_query = """
            SELECT id FROM Menu
            WHERE id = %s AND restaurant_id = %s
        """
        if not self.query(check_query, (menu_id, restaurant_id)):
            return False

        insert_query = """
            INSERT INTO Sale_data (timestamp, amount, menu_id, restaurant_id)
            VALUES (NOW(), %s, %s, %s)
        """

        self.execute(insert_query, (sale_amount, menu_id, restaurant_id))
        return True

    def Q_SendUpdateMenuName(self, restaurant_id):
        # call: Q_SendUpdateMenuName(restaurant_id,)

        query = """
            SELECT id, name
            FROM Menu
            WHERE restaurant_id = %s
        """

        rows = self.query(query, (restaurant_id,))
        result = []
        for row in rows:
            result.append({
                "menu_id": row[0],
                "menu_name": row[1]
            })
        return result
        
    def Q_Login(self, email):
        query = """
            SELECT 
            id,
            username,
            restaurant_id,permission
        FROM User
        WHERE email = %s
        """
        result = self.query(query, (email))
        return {"id": result[0][0] ,"username": result[0][1],"restaurant_id": result[0][2],"permission": result[0][3]}
    
    def Q_password(self, email):

        query = """
          SELECT  password
        FROM User
        WHERE email = %s
        """
        password = self.query(query, (email,))
        return password[0][0]
    
    def E_Register(self, username, restaurant_id, email, password):
        query = """
        INSERT INTO user (username, restaurant_id, email, password)
        VALUES (%s, %s, %s, %s)
        """
        self.execute(query, (username, restaurant_id, email, password))
        return True