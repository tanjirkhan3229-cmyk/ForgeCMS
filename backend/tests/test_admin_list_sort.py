"""Tests for the admin content-list ?sort= ordering.

Run with:  cd backend && pip install -r requirements-dev.txt && pytest
"""

from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.routers.admin as admin
from app.database import Base, get_db
from app.models import ContentItem

NOW = datetime(2026, 6, 1, 12, 0, 0)

# Three published blogs whose published / updated / created orders all differ,
# so a sort that picks the wrong column can't accidentally pass.
SEED = [
    # title,    published_at,            updated_at,             created_at
    ("Banana", NOW - timedelta(days=1), NOW - timedelta(days=9), NOW - timedelta(days=5)),
    ("apple",  NOW - timedelta(days=5), NOW - timedelta(days=1), NOW - timedelta(days=9)),
    ("Cherry", NOW - timedelta(days=9), NOW - timedelta(days=5), NOW - timedelta(days=1)),
]


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = Session()
    for title, pub, upd, crt in SEED:
        db.add(ContentItem(
            module="blogs", title=title, slug=title.lower(), status="published",
            published_at=pub, updated_at=upd, created_at=crt,
        ))
    db.commit()
    db.close()

    def override_db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    application = FastAPI()
    application.include_router(admin.router)
    application.dependency_overrides[get_db] = override_db
    return TestClient(application)


def titles(client, sort=None):
    params = {"status": "published"}
    if sort is not None:
        params["sort"] = sort
    return [i["title"] for i in client.get("/api/admin/blogs", params=params).json()["items"]]


def test_newest_published_first(client):
    assert titles(client, "-published_at") == ["Banana", "apple", "Cherry"]


def test_oldest_published_first(client):
    assert titles(client, "published_at") == ["Cherry", "apple", "Banana"]


def test_title_sort_is_case_insensitive(client):
    # Naive ASCII sort would put "Banana"/"Cherry" before lowercase "apple".
    assert titles(client, "title") == ["apple", "Banana", "Cherry"]


def test_default_sort_is_recently_updated(client):
    # No sort param → newest updated_at first (unchanged legacy behavior).
    assert titles(client, None) == ["apple", "Cherry", "Banana"]


def test_unknown_sort_falls_back_to_default(client):
    # A stale/garbage value must not error or sort by an arbitrary column.
    assert titles(client, "content_html") == titles(client, None)
    assert titles(client, "-id") == titles(client, None)
