import pytest


class TestSale:

    @pytest.fixture
    def seeded_menu_ids(self, client, auth_headers):
        ids = []
        for i, name in enumerate(["Dish Alpha", "Dish Beta"], 1):
            client.post("/api/menu/create", headers=auth_headers, json={
                "name": name, "price": 50 + i * 10, "type": 1,
            })
            menu_items = client.post("/api/menu/list", headers=auth_headers).json().get("Data", [])
            menu_id = menu_items[-1].get("menu_id") or menu_items[-1].get("id")

            client.post("/api/ingredient/create", headers=auth_headers, json={
                "name": f"Ingredient {i}", "unit": "kg", "category": 1,
            })
            ing_items = client.post("/api/ingredient/list", headers=auth_headers, json={}).json().get("Data", [])
            ing_id = ing_items[-1].get("ingredient_id") or ing_items[-1].get("id")

            client.put("/api/ingredient/update-stock", headers=auth_headers, json={
                "ingredient_id": ing_id, "new_stock": 100, "staff_id": 1,
            })
            client.post("/api/recipe/add", headers=auth_headers, json={
                "menu_id": menu_id, "ingredient_id": ing_id, "amount": 0.1,
            })
            ids.append(menu_id)
        return ids

    def test_record_sale_success(self, client, auth_headers, seeded_menu_ids):
        res = client.post("/api/sale/record", headers=auth_headers, json={
            "items": [
                {"menu_id": seeded_menu_ids[0], "amount": 2},
                {"menu_id": seeded_menu_ids[1], "amount": 1},
            ]
        })
        assert res.status_code in (200, 201)
        assert res.json()["message"] == "success"

    def test_record_sale_empty_items(self, client, auth_headers):
        res = client.post("/api/sale/record", headers=auth_headers, json={"items": []})
        assert res.status_code in (200, 400, 422)

    def test_record_sale_nonexistent_menu(self, client, auth_headers):
        res = client.post("/api/sale/record", headers=auth_headers, json={
            "items": [{"menu_id": 99999, "amount": 1}]
        })
        assert res.status_code in (200, 400, 404)

    def test_record_sale_no_token(self, client):
        res = client.post("/api/sale/record", json={
            "items": [{"menu_id": 1, "amount": 1}]
        })
        assert res.status_code in (401, 403, 422)


class TestReport:

    @pytest.fixture(autouse=True)
    def seed_sale(self, client, auth_headers):
        client.post("/api/menu/create", headers=auth_headers, json={
            "name": "Report Dish", "price": 80, "type": 1,
        })
        menu_items = client.post("/api/menu/list", headers=auth_headers).json().get("Data", [])
        self.menu_id = menu_items[-1].get("menu_id") or menu_items[-1].get("id")

        client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "Report Ingredient", "unit": "kg", "category": 1,
        })
        ing_items = client.post("/api/ingredient/list", headers=auth_headers, json={}).json().get("Data", [])
        self.ingredient_id = ing_items[-1].get("ingredient_id") or ing_items[-1].get("id")

        client.put("/api/ingredient/update-stock", headers=auth_headers, json={
            "ingredient_id": self.ingredient_id, "new_stock": 999, "staff_id": 1,
        })
        client.post("/api/recipe/add", headers=auth_headers, json={
            "menu_id": self.menu_id, "ingredient_id": self.ingredient_id, "amount": 0.1,
        })
        client.post("/api/sale/record", headers=auth_headers, json={
            "items": [{"menu_id": self.menu_id, "amount": 3}]
        })

    def test_report_revenue(self, client, auth_headers):
        res = client.post("/api/report/revenue", headers=auth_headers, json={"menu_id": self.menu_id})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_report_orders(self, client, auth_headers):
        res = client.post("/api/report/orders", headers=auth_headers, json={"menu_id": self.menu_id})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_share_menu(self, client, auth_headers):
        res = client.post("/api/report/share/menu", headers=auth_headers, json={})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_share_category(self, client, auth_headers):
        res = client.post("/api/report/share/category", headers=auth_headers, json={})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_trend_menu(self, client, auth_headers):
        res = client.post("/api/report/trend/menu", headers=auth_headers, json={"menu_id": self.menu_id})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_trend_ingredient(self, client, auth_headers):
        res = client.post("/api/report/trend/ingredient", headers=auth_headers, json={
            "ingredient_id": self.ingredient_id,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_report_no_token(self, client):
        res = client.post("/api/report/revenue", json={"menu_id": 1})
        assert res.status_code in (401, 403, 422)


class TestPredict:

    def test_predict_report(self, client, auth_headers):
        res = client.post("/api/predict/report", headers=auth_headers, json={})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_predict_trend(self, client, auth_headers):
        client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "Predict Ingredient", "unit": "kg", "category": 1,
        })
        ing_items = client.post("/api/ingredient/list", headers=auth_headers, json={}).json().get("Data", [])
        ing_id = ing_items[-1].get("ingredient_id") or ing_items[-1].get("id")

        res = client.post("/api/predict/trend", headers=auth_headers, json={"ingredient_id": ing_id})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_predict_no_token(self, client):
        res = client.post("/api/predict/report", json={})
        assert res.status_code in (401, 403, 422)