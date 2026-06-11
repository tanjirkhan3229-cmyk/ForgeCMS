import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MODULE_PATTERN, ContentItem
from ..schemas import ContentList, ContentOut

router = APIRouter(prefix="/api", tags=["public"])

MODULE_PATH = Path(..., pattern=MODULE_PATTERN)


def published(db: Session, module: str):
    return db.query(ContentItem).filter(
        ContentItem.module == module, ContentItem.status == "published"
    )


@router.get("/{module}", response_model=ContentList)
def list_published(
    module: str = MODULE_PATH,
    search: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = published(db, module)
    if category:
        q = q.filter(ContentItem.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(ContentItem.title.ilike(like), ContentItem.excerpt.ilike(like))
        )
    total = q.count()
    items = (
        q.order_by(ContentItem.published_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ContentList(items=items, total=total, page=page, page_size=page_size)


@router.get("/{module}/categories")
def list_categories(module: str = MODULE_PATH, db: Session = Depends(get_db)):
    rows = (
        published(db, module)
        .with_entities(ContentItem.category)
        .filter(ContentItem.category != "")
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows})


@router.get("/{module}/slug/{slug}", response_model=ContentOut)
def read_by_slug(
    module: str = MODULE_PATH,
    slug: str = Path(...),
    db: Session = Depends(get_db),
):
    item = published(db, module).filter(ContentItem.slug == slug).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@router.get("/resources/{item_id}/download")
def download_resource(item_id: int, db: Session = Depends(get_db)):
    item = published(db, "resources").filter(ContentItem.id == item_id).first()
    if not item or not item.file_url:
        raise HTTPException(status_code=404, detail="Resource not found")
    item.download_count += 1
    db.commit()
    # file_url is like /uploads/<stored-name>
    file_path = os.path.join(os.getcwd(), item.file_url.lstrip("/"))
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(
        file_path,
        filename=item.file_name or os.path.basename(file_path),
        media_type=item.file_type or "application/octet-stream",
    )
