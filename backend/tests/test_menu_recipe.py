import pytest


class TestMenu:

    @pytest.fixture
    def created_menu_id(self, client, auth_headers):
        """Helper: create a menu item and return its ID."""
        res = client.post("/api/menu/create", headers=auth_headers, json={
            "name": "Test Dish",
            "price": 55,
            "type": 1,
        })
        assert res.status_code in (200, 201)
        data = res.json().get("Data", {})
        return data.get("menu_id") or data.get("id")

    @pytest.fixture
    def created_ingredient_id(self, client, auth_headers):
        """Helper: create an ingredient and return its ID."""
        res = client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "Recipe Ingredient",
            "unit": "kg",
            "category": 1,
        })
        data = res.json().get("Data", {})
        return data.get("ingredient_id") or data.get("id")

    # ── List ──

    def test_list_menu_success(self, client, auth_headers):
        res = client.post("/api/menu/list", headers=auth_headers, json={})
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "success"
        assert isinstance(data["Data"], list)

    def test_list_menu_no_token(self, client):
        res = client.post("/api/menu/list", json={})
        assert res.status_code in (401, 403, 422)

    # ── Create ──

    def test_create_menu_success(self, client, auth_headers):
        res = client.post("/api/menu/create", headers=auth_headers, json={
            "name": "Pork Kapaw",
            "price": 55,
            "type": 1,
        })
        assert res.status_code in (200, 201)
        assert res.json()["message"] == "success"

    def test_create_menu_missing_name(self, client, auth_headers):
        res = client.post("/api/menu/create", headers=auth_headers, json={
            "price": 55,
            "type": 1,
        })
        assert res.status_code == 422

    def test_create_menu_missing_price(self, client, auth_headers):
        res = client.post("/api/menu/create", headers=auth_headers, json={
            "name": "No Price",
            "type": 1,
        })
        assert res.status_code == 422

    def test_create_menu_no_token(self, client):
        res = client.post("/api/menu/create", json={"name": "x", "price": 10, "type": 1})
        assert res.status_code in (401, 403, 422)

    # ── Update ──

    def test_update_menu_success(self, client, auth_headers, created_menu_id):
        res = client.put("/api/menu/update", headers=auth_headers, json={
            "menu_id": created_menu_id,
            "name": "Updated Dish",
            "price": 75,
            "type": 1,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_update_menu_nonexistent(self, client, auth_headers):
        res = client.put("/api/menu/update", headers=auth_headers, json={
            "menu_id": 99999,
            "price": 75,
        })
        assert res.status_code in (404, 400)

    def test_update_menu_no_token(self, client):
        res = client.put("/api/menu/update", json={"menu_id": 1, "price": 10})
        assert res.status_code in (401, 403, 422)

    # ── Delete ──

    def test_delete_menu_success(self, client, auth_headers, created_menu_id):
        res = client.delete("/api/menu/delete", headers=auth_headers, json={
            "menu_id": created_menu_id,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_delete_menu_nonexistent(self, client, auth_headers):
        res = client.delete("/api/menu/delete", headers=auth_headers, json={
            "menu_id": 99999,
        })
        assert res.status_code in (404, 400)

    def test_delete_menu_no_token(self, client):
        res = client.delete("/api/menu/delete", json={"menu_id": 1})
        assert res.status_code in (401, 403, 422)


class TestRecipe:

    @pytest.fixture
    def menu_and_ingredient(self, client, auth_headers):
        """Helper: returns (menu_id, ingredient_id)."""
        menu_res = client.post("/api/menu/create", headers=auth_headers, json={
            "name": "Recipe Test Menu",
            "price": 60,
            "type": 1,
        })
        menu_id = menu_res.json().get("Data", {}).get("menu_id") or \
                  menu_res.json().get("Data", {}).get("id")

        ing_res = client.post("/api/ingredient/create", headers=auth_headers, json={
            "name": "Recipe Test Ing",
            "unit": "g",
            "category": 1,
        })
        ing_id = ing_res.json().get("Data", {}).get("ingredient_id") or \
                 ing_res.json().get("Data", {}).get("id")

        return menu_id, ing_id

    # ── Add ──

    def test_add_recipe_success(self, client, auth_headers, menu_and_ingredient):
        menu_id, ing_id = menu_and_ingredient
        res = client.post("/api/recipe/add", headers=auth_headers, json={
            "menu_id": menu_id,
            "ingredient_id": ing_id,
            "amount": 0.15,
        })
        assert res.status_code in (200, 201)
        assert res.json()["message"] == "success"

    def test_add_recipe_duplicate(self, client, auth_headers, menu_and_ingredient):
        menu_id, ing_id = menu_and_ingredient
        payload = {"menu_id": menu_id, "ingredient_id": ing_id, "amount": 0.15}
        client.post("/api/recipe/add", headers=auth_headers, json=payload)
        res = client.post("/api/recipe/add", headers=auth_headers, json=payload)
        assert res.status_code in (200, 400, 409)

    def test_add_recipe_no_token(self, client):
        res = client.post("/api/recipe/add", json={
            "menu_id": 1, "ingredient_id": 1, "amount": 0.1,
        })
        assert res.status_code in (401, 403, 422)

    # ── Edit ──

    def test_edit_recipe_success(self, client, auth_headers, menu_and_ingredient):
        menu_id, ing_id = menu_and_ingredient
        client.post("/api/recipe/add", headers=auth_headers, json={
            "menu_id": menu_id, "ingredient_id": ing_id, "amount": 0.15,
        })
        res = client.put("/api/recipe/edit", headers=auth_headers, json={
            "menu_id": menu_id,
            "ingredient_id": ing_id,
            "amount": 0.50,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_edit_recipe_nonexistent(self, client, auth_headers):
        res = client.put("/api/recipe/edit", headers=auth_headers, json={
            "menu_id": 99999,
            "ingredient_id": 99999,
            "amount": 0.5,
        })
        assert res.status_code in (404, 400)

    # ── Delete ──

    def test_delete_recipe_success(self, client, auth_headers, menu_and_ingredient):
        menu_id, ing_id = menu_and_ingredient
        client.post("/api/recipe/add", headers=auth_headers, json={
            "menu_id": menu_id, "ingredient_id": ing_id, "amount": 0.15,
        })
        res = client.delete("/api/recipe/delete", headers=auth_headers, json={
            "menu_id": menu_id,
            "ingredient_id": ing_id,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_delete_recipe_nonexistent(self, client, auth_headers):
        res = client.delete("/api/recipe/delete", headers=auth_headers, json={
            "menu_id": 99999,
            "ingredient_id": 99999,
        })
        assert res.status_code in (404, 400)

    # ── Detail ──

    def test_get_recipe_detail(self, client, auth_headers, menu_and_ingredient):
        menu_id, ing_id = menu_and_ingredient
        client.post("/api/recipe/add", headers=auth_headers, json={
            "menu_id": menu_id, "ingredient_id": ing_id, "amount": 0.15,
        })
        res = client.post("/api/recipe/detail", headers=auth_headers, json={
            "menu_id": menu_id,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"
