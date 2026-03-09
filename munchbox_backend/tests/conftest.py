import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch
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
    """Create all tables once for the test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Fresh DB session per test, rolled back after."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    """TestClient with DB override."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Auth helpers ──
@pytest.fixture
def auth_headers(client):
    """Register + login and return Bearer headers."""
    client.post("/api/register", json={
        "username": "testuser",
        "email": "test@munchbox.com",
        "password": "testpass123",
    })
    res = client.post("/api/login", json={
        "email": "test@munchbox.com",
        "password": "testpass123",
    })
    token = res.json().get("token") or res.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client):
    """Admin user headers (permission=1)."""
    client.post("/api/register", json={
        "username": "adminuser",
        "email": "admin@munchbox.com",
        "password": "adminpass123",
        "permission": 1,
    })
    res = client.post("/api/login", json={
        "email": "admin@munchbox.com",
        "password": "adminpass123",
    })
    token = res.json().get("token") or res.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}
