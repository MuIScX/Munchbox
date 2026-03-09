import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# ── Set test environment before importing app ──
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest"
os.environ["DATABASE_URL"] = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:root@127.0.0.1:3306/munchbox_test"
)

from app.main import app
from app.db import get_db, Base

# ── Test DB engine ──
engine = create_engine(os.environ["DATABASE_URL"])
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once, drop after session."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def client():
    """Single TestClient for entire session."""
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Auth helpers ──
@pytest.fixture(scope="session")
def auth_headers(client):
    """Register + login once for entire session."""
    # First create a restaurant
    res_restaurant = client.post("/api/restaurant/create", json={
        "name": "Test Restaurant",
        "start_date": "2024-01-01",
        "end_date": "2025-12-31",
        "package": 1,
    })
    # Use restaurant_id 1 regardless (may already exist)
    restaurant_id = res_restaurant.json().get("Data", {}).get("restaurant_id", 1)

    client.post("/api/register", json={
        "username": "testuser",
        "email": "test@munchbox.com",
        "password": "testpass123",
        "restaurant_id": restaurant_id,
    })
    res = client.post("/api/login", json={
        "email": "test@munchbox.com",
        "password": "testpass123",
    })
    token = res.json().get("token") or res.json().get("access_token")
    assert token is not None, f"Login failed: {res.json()}"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_headers(client):
    """Admin user headers (permission=1)."""
    client.post("/api/register", json={
        "username": "adminuser",
        "email": "admin@munchbox.com",
        "password": "adminpass123",
        "restaurant_id": 1,
        "permission": 1,
    })
    res = client.post("/api/login", json={
        "email": "admin@munchbox.com",
        "password": "adminpass123",
    })
    token = res.json().get("token") or res.json().get("access_token")
    assert token is not None, f"Admin login failed: {res.json()}"
    return {"Authorization": f"Bearer {token}"}