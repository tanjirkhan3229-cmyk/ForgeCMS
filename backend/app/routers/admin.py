import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MODULE_PATTERN, MODULES, STATUSES, ContentItem
from ..sanitize import sanitize_html
from ..schemas import (
    ContentCreate,
    ContentList,
    ContentOut,
    ContentUpdate,
    DashboardOut,
    ScheduleIn,
    StatsOut,
)
from .auth import require_role

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Authors may create and edit content; publishing, scheduling, duplicating and
# deleting are reserved for editors and admins. Content has no per-author
# ownership field, so authors aren't restricted to their own items.
EDIT_ROLES = ("admin", "editor", "author")
MANAGE_ROLES = ("admin", "editor")

MODULE_PATH = Path(..., pattern=MODULE_PATTERN)


def is_past(dt: datetime) -> bool:
    """True if dt is before the current instant, compared in UTC.

    Naive datetimes are treated as UTC, matching the scheduler's naive-UTC
    `publish_at <= utcnow()` comparison; tz-aware values are converted to UTC.
    """
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt < now


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "untitled"


def unique_slug(db: Session, module: str, base: str, exclude_id: Optional[int] = None) -> str:
    slug, n = base, 2
    while True:
        q = db.query(ContentItem).filter(
            ContentItem.module == module, ContentItem.slug == slug
        )
        if exclude_id is not None:
            q = q.filter(ContentItem.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def get_item(db: Session, module: str, item_id: int) -> ContentItem:
    item = (
        db.query(ContentItem)
        .filter(ContentItem.module == module, ContentItem.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# Declared before the /{module} routes so the literal path wins.
@router.get("/stats")
def overview_stats(db: Session = Depends(get_db)):
    out = {}
    for module in MODULES:
        base = db.query(ContentItem).filter(ContentItem.module == module)
        out[module] = {
            "drafts": base.filter(ContentItem.status == "draft").count(),
            "scheduled": base.filter(ContentItem.status == "scheduled").count(),
            "published": base.filter(ContentItem.status == "published").count(),
            "total": base.count(),
        }
    return out


# Literal path — must precede the /{module} routes so it isn't captured as a module.
@router.get("/dashboard", response_model=DashboardOut)
def dashboard_stats(db: Session = Depends(get_db)):
    """Authoritative dashboard aggregates, computed in SQL over the whole table.

    The dashboard previously derived these from one 50-item page per module, so
    both undercounted once a module grew past a page or the top downloads
    weren't recently updated. These run against every row instead.
    """
    week_ago = datetime.utcnow() - timedelta(days=7)
    published_this_week = (
        db.query(func.count(ContentItem.id))
        .filter(ContentItem.status == "published", ContentItem.published_at >= week_ago)
        .scalar()
    )
    resource_downloads = (
        db.query(func.coalesce(func.sum(ContentItem.download_count), 0))
        .filter(ContentItem.module == "resources")
        .scalar()
    )
    return DashboardOut(
        published_this_week=int(published_this_week or 0),
        resource_downloads=int(resource_downloads or 0),
    )


@router.get("/{module}/stats", response_model=StatsOut)
def module_stats(module: str = MODULE_PATH, db: Session = Depends(get_db)):
    base = db.query(ContentItem).filter(ContentItem.module == module)
    return StatsOut(
        drafts=base.filter(ContentItem.status == "draft").count(),
        scheduled=base.filter(ContentItem.status == "scheduled").count(),
        published=base.filter(ContentItem.status == "published").count(),
        total=base.count(),
    )


@router.get("/{module}", response_model=ContentList)
def list_items(
    module: str = MODULE_PATH,
    status: Optional[str] = Query(None, pattern="^(draft|scheduled|published)$"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(ContentItem).filter(ContentItem.module == module)
    if status:
        q = q.filter(ContentItem.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(ContentItem.title.ilike(like), ContentItem.excerpt.ilike(like)))
    total = q.count()
    items = (
        q.order_by(ContentItem.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ContentList(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "/{module}",
    response_model=ContentOut,
    status_code=201,
    dependencies=[Depends(require_role(*EDIT_ROLES))],
)
def create_item(
    payload: ContentCreate,
    module: str = MODULE_PATH,
    db: Session = Depends(get_db),
):
    if payload.status not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    base = slugify(payload.slug or payload.title or "untitled")
    item = ContentItem(
        module=module,
        **payload.model_dump(exclude={"slug", "status", "publish_at"}),
        slug=unique_slug(db, module, base),
        status=payload.status,
        publish_at=payload.publish_at,
    )
    # Public pages render content_html as raw HTML, so strip any script/handlers
    # before it is ever persisted.
    item.content_html = sanitize_html(item.content_html)
    if item.status == "published":
        item.published_at = datetime.utcnow()
    if item.status == "scheduled":
        if not item.publish_at:
            raise HTTPException(status_code=422, detail="publish_at required for scheduled items")
        if is_past(item.publish_at):
            raise HTTPException(status_code=422, detail="publish_at must be in the future")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{module}/{item_id}", response_model=ContentOut)
def read_item(
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return get_item(db, module, item_id)


@router.put(
    "/{module}/{item_id}",
    response_model=ContentOut,
    dependencies=[Depends(require_role(*EDIT_ROLES))],
)
def update_item(
    payload: ContentUpdate,
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"]:
        data["slug"] = unique_slug(db, module, slugify(data["slug"]), exclude_id=item.id)
    if "content_html" in data:
        data["content_html"] = sanitize_html(data["content_html"])
    new_status = data.get("status")
    if new_status and new_status not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    for key, value in data.items():
        setattr(item, key, value)
    if item.status == "scheduled":
        if not item.publish_at:
            raise HTTPException(status_code=422, detail="publish_at required for scheduled items")
        # Only re-validate against "now" when this request actually sets the
        # time, so unrelated edits to an already-scheduled item don't 422.
        if "publish_at" in data and is_past(item.publish_at):
            raise HTTPException(status_code=422, detail="publish_at must be in the future")
    if new_status == "published" and not item.published_at:
        item.published_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/{module}/{item_id}",
    status_code=204,
    dependencies=[Depends(require_role(*MANAGE_ROLES))],
)
def delete_item(
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    db.delete(item)
    db.commit()


@router.post(
    "/{module}/{item_id}/publish",
    response_model=ContentOut,
    dependencies=[Depends(require_role(*MANAGE_ROLES))],
)
def publish_item(
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    item.status = "published"
    item.published_at = item.published_at or datetime.utcnow()
    item.publish_at = None
    db.commit()
    db.refresh(item)
    return item


@router.post(
    "/{module}/{item_id}/unpublish",
    response_model=ContentOut,
    dependencies=[Depends(require_role(*MANAGE_ROLES))],
)
def unpublish_item(
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    item.status = "draft"
    item.publish_at = None
    db.commit()
    db.refresh(item)
    return item


@router.post(
    "/{module}/{item_id}/schedule",
    response_model=ContentOut,
    dependencies=[Depends(require_role(*MANAGE_ROLES))],
)
def schedule_item(
    payload: ScheduleIn,
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    if is_past(payload.publish_at):
        raise HTTPException(status_code=422, detail="publish_at must be in the future")
    item.status = "scheduled"
    item.publish_at = payload.publish_at
    db.commit()
    db.refresh(item)
    return item


@router.post(
    "/{module}/{item_id}/duplicate",
    response_model=ContentOut,
    status_code=201,
    dependencies=[Depends(require_role(*MANAGE_ROLES))],
)
def duplicate_item(
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    src = get_item(db, module, item_id)
    copy = ContentItem(
        module=module,
        title=f"{src.title} (copy)",
        slug=unique_slug(db, module, f"{src.slug}-copy"),
        excerpt=src.excerpt,
        content=src.content,
        content_html=src.content_html,
        cover_image=src.cover_image,
        category=src.category,
        tags=src.tags,
        author=src.author,
        meta_title=src.meta_title,
        meta_description=src.meta_description,
        schema_code=src.schema_code,
        file_url=src.file_url,
        file_name=src.file_name,
        file_size=src.file_size,
        file_type=src.file_type,
        status="draft",
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy
