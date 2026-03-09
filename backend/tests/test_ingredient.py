import pytest
import json as jsonlib


class TestIngredient:

    @pytest.fixture
    def created_ingredient_id(self, client, auth_headers):
        res = client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "Test Tomato", "unit": "kg", "category": 1,
        })
        assert res.status_code in (200, 201)
        data = res.json().get("Data")
        if isinstance(data, list):
            return data[0].get("ingredient_id") or data[0].get("id")
        return data.get("ingredient_id") or data.get("id")

    def test_list_ingredients_no_filter(self, client, auth_headers):
        res = client.post("/api/ingredient/list", headers=auth_headers, json={})
        assert res.status_code == 200
        assert res.json()["message"] == "success"
        assert isinstance(res.json()["Data"], list)

    def test_list_ingredients_with_category(self, client, auth_headers):
        res = client.post("/api/ingredient/list", headers=auth_headers, json={"category": 1})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_list_ingredients_no_token(self, client):
        res = client.post("/api/ingredient/list", json={})
        assert res.status_code in (401, 403, 422)

    def test_create_ingredient_success(self, client, auth_headers):
        res = client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "Fresh Tomato", "unit": "kg", "category": 4,
        })
        assert res.status_code in (200, 201)
        assert res.json()["message"] == "success"

    def test_create_ingredient_missing_name(self, client, auth_headers):
        res = client.post("/api/ingredient/create", headers=auth_headers, json={
            "unit": "kg", "category": 1,
        })
        assert res.status_code == 422

    def test_create_ingredient_missing_unit(self, client, auth_headers):
        res = client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "NoUnit", "category": 1,
        })
        assert res.status_code == 422

    def test_create_ingredient_no_token(self, client):
        res = client.post("/api/ingredient/create", json={
            "name": "Sneaky", "unit": "kg", "category": 1,
        })
        assert res.status_code in (401, 403, 422)

    def test_update_stock_success(self, client, auth_headers, created_ingredient_id):
        res = client.put("/api/ingredient/update-stock", headers=auth_headers, json={
            "ingredient_id": created_ingredient_id, "new_stock": 50, "staff_id": 1,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_update_stock_nonexistent(self, client, auth_headers):
        res = client.put("/api/ingredient/update-stock", headers=auth_headers, json={
            "ingredient_id": 99999, "new_stock": 10, "staff_id": 1,
        })
        assert res.status_code in (404, 400)

    def test_update_stock_negative(self, client, auth_headers, created_ingredient_id):
        res = client.put("/api/ingredient/update-stock", headers=auth_headers, json={
            "ingredient_id": created_ingredient_id, "new_stock": -5, "staff_id": 1,
        })
        assert res.status_code in (200, 400, 422)

    def test_get_ingredient_log(self, client, auth_headers, created_ingredient_id):
        client.put("/api/ingredient/update-stock", headers=auth_headers, json={
            "ingredient_id": created_ingredient_id, "new_stock": 20, "staff_id": 1,
        })
        res = client.post("/api/ingredient/log", headers=auth_headers, json={
            "ingredient_id": created_ingredient_id,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_get_all_logs(self, client, auth_headers):
        res = client.post("/api/ingredient/log", headers=auth_headers, json={"ingredient_id": None})
        assert res.status_code == 200

    def test_get_log_no_token(self, client):
        res = client.post("/api/ingredient/log", json={"ingredient_id": 1})
        assert res.status_code in (401, 403, 422)

    def test_get_status(self, client, auth_headers):
        res = client.post("/api/ingredient/status", headers=auth_headers, json={})
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_get_status_no_token(self, client):
        res = client.post("/api/ingredient/status", json={})
        assert res.status_code in (401, 403, 422)

    def test_delete_ingredient_success(self, client, auth_headers, created_ingredient_id):
        res = client.delete("/api/ingredient/delete",
            headers=auth_headers,
            content=jsonlib.dumps({"ingredient_id": created_ingredient_id}),
        )
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_delete_ingredient_nonexistent(self, client, auth_headers):
        res = client.delete("/api/ingredient/delete",
            headers={**auth_headers, "Content-Type": "application/json"},
            content=jsonlib.dumps({"ingredient_id": 99999}),
        )
        assert res.status_code in (404, 400)

    def test_delete_ingredient_no_token(self, client):
        res = client.delete("/api/ingredient/delete",
            headers={"Content-Type": "application/json"},
            content=jsonlib.dumps({"ingredient_id": 1}),
        )
        assert res.status_code in (401, 403, 422)