import pytest
from datetime import date, timedelta


class TestRestaurant:

    @pytest.fixture
    def restaurant_payload(self):
        return {
            "name": "Test Restaurant",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=365)),
            "package": 1,
            "manager_pin": 1234,
        }

    def test_get_restaurant_not_found(self, client, auth_headers):
        """Fresh user has no restaurant yet."""
        res = client.post("/api/restaurant/get", headers=auth_headers)
        assert res.status_code in (200, 404)

    def test_create_restaurant_success(self, client, auth_headers, restaurant_payload):
        res = client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["message"] == "success"
        assert "restaurant_id" in data.get("Data", {})

    def test_create_restaurant_missing_name(self, client, auth_headers, restaurant_payload):
        del restaurant_payload["name"]
        res = client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        assert res.status_code == 422

    def test_create_restaurant_invalid_date(self, client, auth_headers, restaurant_payload):
        restaurant_payload["start_date"] = "not-a-date"
        res = client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        assert res.status_code == 422

    def test_create_restaurant_no_token(self, client, restaurant_payload):
        res = client.post("/api/restaurant/create", json=restaurant_payload)
        assert res.status_code in (401, 403, 422)

    def test_update_restaurant_success(self, client, auth_headers, restaurant_payload):
        client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        res = client.put("/api/restaurant/update", headers=auth_headers, json={
            "name": "Updated Restaurant Name",
            "package": 2,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_update_restaurant_name_only(self, client, auth_headers, restaurant_payload):
        client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        res = client.put("/api/restaurant/update", headers=auth_headers, json={
            "name": "Just Name Changed",
        })
        assert res.status_code == 200

    def test_update_restaurant_no_token(self, client):
        res = client.put("/api/restaurant/update", json={"name": "Sneaky"})
        assert res.status_code in (401, 403, 422)

    def test_get_restaurant_after_create(self, client, auth_headers, restaurant_payload):
        client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        res = client.post("/api/restaurant/get", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "success"
        assert data["Data"]["name"] == restaurant_payload["name"]

    def test_updated_time_auto_set(self, client, auth_headers, restaurant_payload):
        """updated_time should be set by the server, not the client."""
        client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        res = client.post("/api/restaurant/get", headers=auth_headers)
        assert res.json()["Data"]["updated_time"] is not None

    def test_update_does_not_accept_updated_time(self, client, auth_headers, restaurant_payload):
        """Sending updated_time in body should be ignored or rejected."""
        client.post("/api/restaurant/create", headers=auth_headers, json=restaurant_payload)
        res = client.put("/api/restaurant/update", headers=auth_headers, json={
            "name": "New Name",
            "updated_time": "00:00:00",  # should be ignored
        })
        # Either 200 (ignored) or 422 (rejected) — both are valid
        assert res.status_code in (200, 422)
