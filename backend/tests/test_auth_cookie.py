"""Tests for cookie-based session auth.

Run with:  cd backend && pip install -r requirements.txt pytest && pytest
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.routers.auth as auth
from app.database import Base, get_db
from app.models import User


class _FakeSupabaseResp:
    status_code = 200

    def json(self):
        return {
            "user": {
                "app_metadata": {"forge_role": "admin"},
                "user_metadata": {"name": "Ada"},
            }
        }


class _FakeSupabaseClient:
    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, *a, **k):
        return _FakeSupabaseResp()


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = Session()
    db.add(User(name="Ada", email="ada@example.com", role="admin", status="active"))
    db.commit()
    db.close()

    monkeypatch.setattr(auth, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(auth, "SUPABASE_ANON_KEY", "anon")
    monkeypatch.setattr(auth, "COOKIE_SECURE", True)
    monkeypatch.setattr(auth.httpx, "AsyncClient", _FakeSupabaseClient)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    application = FastAPI()
    application.include_router(auth.router)
    application.dependency_overrides[get_db] = override_db
    # https base so the Secure cookie round-trips in the test client's jar.
    return TestClient(application, base_url="https://testserver")


def test_login_sets_httponly_cookie_and_no_token_in_body(client):
    r = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "pw"})
    assert r.status_code == 200
    body = r.json()
    assert "token" not in body
    assert body["email"] == "ada@example.com"
    cookie = r.headers.get("set-cookie", "").lower()
    assert "forge_session=" in cookie
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert "secure" in cookie


def test_me_succeeds_via_cookie(client):
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": "pw"})
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "ada@example.com"


def test_me_without_session_is_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_bearer_header_still_accepted(client):
    token = auth.make_token("ada@example.com")
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_logout_clears_cookie(client):
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": "pw"})
    r = client.post("/api/auth/logout")
    assert r.status_code == 204
    # Cookie is cleared in the jar, so a follow-up /me is unauthenticated.
    assert client.get("/api/auth/me").status_code == 401
