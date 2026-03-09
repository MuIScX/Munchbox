import pytest


class TestAuth:

    def test_register_success(self, client):
        res = client.post("/api/register", json={
            "username": "newuser",
            "email": "newuser@test.com",
            "password": "password123",
        })
        assert res.status_code in (200, 201)
        data = res.json()
        assert data.get("message") == "success"

    def test_register_duplicate_email(self, client):
        payload = {"username": "dup", "email": "dup@test.com", "password": "pass"}
        client.post("/api/register", json=payload)
        res = client.post("/api/register", json=payload)
        assert res.status_code in (400, 409, 422)

    def test_register_missing_fields(self, client):
        res = client.post("/api/register", json={"email": "nopw@test.com"})
        assert res.status_code == 422

    def test_login_success(self, client):
        client.post("/api/register", json={
            "username": "loginuser",
            "email": "login@test.com",
            "password": "mypassword",
        })
        res = client.post("/api/login", json={
            "email": "login@test.com",
            "password": "mypassword",
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data or "access_token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/register", json={
            "username": "loginuser2",
            "email": "login2@test.com",
            "password": "correctpass",
        })
        res = client.post("/api/login", json={
            "email": "login2@test.com",
            "password": "wrongpass",
        })
        assert res.status_code in (401, 400)

    def test_login_nonexistent_user(self, client):
        res = client.post("/api/login", json={
            "email": "ghost@test.com",
            "password": "nopass",
        })
        assert res.status_code in (401, 404, 400)

    def test_login_missing_fields(self, client):
        res = client.post("/api/login", json={"email": "only@test.com"})
        assert res.status_code == 422

    def test_get_me(self, client, auth_headers):
        res = client.get("/api/user/me", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "success"
        assert "Data" in data

    def test_get_me_no_token(self, client):
        res = client.get("/api/user/me")
        assert res.status_code in (401, 403, 422)
