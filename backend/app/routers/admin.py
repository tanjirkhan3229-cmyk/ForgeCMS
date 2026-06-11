import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MODULES, STATUSES, ContentItem
from ..schemas import (
    ContentCreate,
    ContentList,
    ContentOut,
    ContentUpdate,
    ScheduleIn,
    StatsOut,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

MODULE_PATH = Path(..., pattern="^(blogs|news|resources|faqs)$")


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


@router.post("/{module}", response_model=ContentOut, status_code=201)
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
    if item.status == "published":
        item.published_at = datetime.utcnow()
    if item.status == "scheduled" and not item.publish_at:
        raise HTTPException(status_code=422, detail="publish_at required for scheduled items")
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


@router.put("/{module}/{item_id}", response_model=ContentOut)
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
    new_status = data.get("status")
    if new_status and new_status not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    for key, value in data.items():
        setattr(item, key, value)
    if new_status == "published" and not item.published_at:
        item.published_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{module}/{item_id}", status_code=204)
def delete_item(
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    db.delete(item)
    db.commit()


@router.post("/{module}/{item_id}/publish", response_model=ContentOut)
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


@router.post("/{module}/{item_id}/unpublish", response_model=ContentOut)
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


@router.post("/{module}/{item_id}/schedule", response_model=ContentOut)
def schedule_item(
    payload: ScheduleIn,
    module: str = MODULE_PATH,
    item_id: int = Path(...),
    db: Session = Depends(get_db),
):
    item = get_item(db, module, item_id)
    item.status = "scheduled"
    item.publish_at = payload.publish_at
    db.commit()
    db.refresh(item)
    return item


@router.post("/{module}/{item_id}/duplicate", response_model=ContentOut, status_code=201)
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
