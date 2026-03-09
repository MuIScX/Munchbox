import pytest


class TestStaff:

    def test_list_staff_success(self, client, auth_headers):
        res = client.post("/api/staff/list", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "success"
        assert "Data" in data
        assert isinstance(data["Data"], list)

    def test_list_staff_no_token(self, client):
        res = client.post("/api/staff/list")
        assert res.status_code in (401, 403, 422)

    def test_create_staff_success(self, client, auth_headers):
        res = client.post("/api/staff/create", headers=auth_headers, json={
            "name": "Johnson",
            "role": 1,
        })
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["message"] == "success"

    def test_create_staff_missing_name(self, client, auth_headers):
        res = client.post("/api/staff/create", headers=auth_headers, json={"role": 1})
        assert res.status_code == 422

    def test_create_staff_missing_role(self, client, auth_headers):
        res = client.post("/api/staff/create", headers=auth_headers, json={"name": "NoRole"})
        assert res.status_code == 422

    def test_update_staff_success(self, client, auth_headers):
        # Create first
        create_res = client.post("/api/staff/create", headers=auth_headers, json={
            "name": "UpdateMe",
            "role": 0,
        })
        staff_id = create_res.json().get("Data", {}).get("staff_id") or \
                   create_res.json().get("Data", {}).get("id")

        res = client.put("/api/staff/update", headers=auth_headers, json={
            "staff_id": staff_id,
            "name": "Updated Name",
            "role": 1,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_update_staff_nonexistent(self, client, auth_headers):
        res = client.put("/api/staff/update", headers=auth_headers, json={
            "staff_id": 99999,
            "name": "Ghost",
            "role": 0,
        })
        assert res.status_code in (404, 400)

    def test_delete_staff_success(self, client, auth_headers):
        create_res = client.post("/api/staff/create", headers=auth_headers, json={
            "name": "DeleteMe",
            "role": 0,
        })
        staff_id = create_res.json().get("Data", {}).get("staff_id") or \
                   create_res.json().get("Data", {}).get("id")

        res = client.delete("/api/staff/delete", headers=auth_headers, json={
            "staff_id": staff_id,
        })
        assert res.status_code == 200
        assert res.json()["message"] == "success"

    def test_delete_staff_nonexistent(self, client, auth_headers):
        res = client.delete("/api/staff/delete", headers=auth_headers, json={
            "staff_id": 99999,
        })
        assert res.status_code in (404, 400)

    def test_delete_staff_no_token(self, client):
        res = client.delete("/api/staff/delete", json={"staff_id": 1})
        assert res.status_code in (401, 403, 422)
