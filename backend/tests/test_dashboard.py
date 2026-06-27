"""Tests for the dashboard SQL aggregates.

Run with:  cd backend && pip install -r requirements.txt pytest && pytest
"""

from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.routers.admin as admin
from app.database import Base, get_db
from app.models import ContentItem

PAGE_SIZE = 50  # the slice size the old client logic was limited to


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    now = datetime.utcnow()
    db = Session()
    # Seed > PAGE_SIZE items per module, with downloads concentrated on
    # resources that are NOT recently updated — exactly what defeated the old
    # client-side page slice.
    for module in ("blogs", "news", "resources", "faqs"):
        for i in range(70):
            if module == "resources":
                db.add(ContentItem(
                    module=module, title=f"{module}-{i}", slug=f"{module}-{i}",
                    status="published", published_at=now - timedelta(days=30),
                    download_count=i,
                ))
            else:
                recent = i % 2 == 0
                db.add(ContentItem(
                    module=module, title=f"{module}-{i}", slug=f"{module}-{i}",
                    status="published",
                    published_at=now - timedelta(days=1 if recent else 20),
                ))
    # Drafts have no published_at and must never count toward the weekly total.
    for i in range(5):
        db.add(ContentItem(module="blogs", title=f"d{i}", slug=f"d{i}", status="draft"))
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
    application.state.Session = Session
    return TestClient(application)


def _full_db_truth(Session):
    s = Session()
    try:
        week_ago = datetime.utcnow() - timedelta(days=7)
        week = (
            s.query(func.count(ContentItem.id))
            .filter(ContentItem.status == "published", ContentItem.published_at >= week_ago)
            .scalar()
        )
        downloads = (
            s.query(func.coalesce(func.sum(ContentItem.download_count), 0))
            .filter(ContentItem.module == "resources")
            .scalar()
        )
        return int(week), int(downloads)
    finally:
        s.close()


def test_dashboard_matches_full_db_aggregates(client):
    Session = client.app.state.Session
    week, downloads = _full_db_truth(Session)

    body = client.get("/api/admin/dashboard").json()
    assert body["published_this_week"] == week
    assert body["resource_downloads"] == downloads


def test_aggregates_exceed_a_single_page_slice(client):
    # Guards against regressing to the page-slice bug: the true totals are
    # strictly larger than anything the first 50 items could have produced.
    body = client.get("/api/admin/dashboard").json()
    assert body["resource_downloads"] == sum(range(70))      # 2415
    assert body["resource_downloads"] > sum(range(PAGE_SIZE))  # > 1225
    assert body["published_this_week"] == 3 * 35              # 105 across 3 modules
    assert body["published_this_week"] > PAGE_SIZE


def test_drafts_do_not_count_toward_weekly(client):
    # All seeded drafts lack published_at; weekly count stays at the published total.
    body = client.get("/api/admin/dashboard").json()
    assert body["published_this_week"] == 105


def test_dashboard_route_not_shadowed_by_module_route(client):
    # /dashboard must resolve to the aggregate endpoint, not GET /{module}.
    r = client.get("/api/admin/dashboard")
    assert r.status_code == 200
    assert set(r.json().keys()) == {"published_this_week", "resource_downloads"}
