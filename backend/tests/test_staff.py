import pytest


class TestStaff:

    def test_list_staff_success(self, client, auth_headers):
        res = client.post("/api/staff/list", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "success"
        assert isinstance(data["Data"], list)

    def test_list_staff_no_token(self, client):
        res = client.post("/api/staff/list")
        assert res.status_code in (401, 403, 422)

    def test_create_staff_success(self, client, auth_headers):
        res = client.post("/api/staff/create", headers=auth_headers, json={
            "name": "Johnson", "username": "johnson01", "password": "pass123", "role": 3,
        })
        assert res.status_code in (200, 201)
        assert res.json()["message"] == "success"

    def test_create_staff_missing_name(self, client, auth_headers):
        res = client.post("/api/staff/create", headers=auth_headers, json={
            "username": "noname", "password": "pass123", "role": 3,
        })
        assert res.status_code == 422

    def test_create_staff_missing_role(self, client, auth_headers):
        res = client.post("/api/staff/create", headers=auth_headers, json={
            "name": "NoRole", "username": "norole", "password": "pass123",
        })
        assert res.status_code == 422

    def test_update_staff_success(self, client, auth_headers):
        client.post("/api/staff/create", headers=auth_headers, json={
            "name": "UpdateMe", "username": "updateme01", "password": "pass123", "role": 3,
        })
        list_res = client.post("/api/staff/list", headers=auth_headers)
        staff_id = list_res.json()["Data"][-1].get("staff_id") or list_res.json()["Data"][-1].get("id")

        res = client.put("/api/staff/update", headers=auth_headers, json={
            "staff_id": staff_id, "name": "Updated Name", "role": 2,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_update_staff_nonexistent(self, client, auth_headers):
        res = client.put("/api/staff/update", headers=auth_headers, json={
            "staff_id": 99999, "role": 3,
        })
        assert res.status_code in (404, 400)

    def test_delete_staff_success(self, client, auth_headers):
        client.post("/api/staff/create", headers=auth_headers, json={
            "name": "DeleteMe", "username": "deleteme01", "password": "pass123", "role": 3,
        })
        list_res = client.post("/api/staff/list", headers=auth_headers)
        staff_id = list_res.json()["Data"][-1].get("staff_id") or list_res.json()["Data"][-1].get("id")

        res = client.request("DELETE", "/api/staff/delete",
            headers=auth_headers,
            json={"staff_id": staff_id},
        )
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_delete_staff_nonexistent(self, client, auth_headers):
        res = client.request("DELETE", "/api/staff/delete",
            headers=auth_headers,
            json={"staff_id": 99999},
        )
        assert res.status_code in (404, 400)

    def test_delete_staff_no_token(self, client):
        res = client.request("DELETE", "/api/staff/delete",
            json={"staff_id": 1},
        )
        assert res.status_code in (401, 403, 422)
