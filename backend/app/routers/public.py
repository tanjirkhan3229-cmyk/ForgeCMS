import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MODULES, ContentItem
from ..schemas import ContentList, ContentOut

router = APIRouter(prefix="/api", tags=["public"])


def valid_module(module: str = Path(...)) -> str:
    """Resolve the {module} path segment, 404ing on an unknown module.

    An unknown module is a missing resource, not a malformed request, so this
    returns 404 (JSON) rather than the 422 a bare pattern constraint produced.
    A 404 here also keeps unmatched /api/* paths from ever reaching the SPA
    fallback and being answered with index.html.
    """
    if module not in MODULES:
        raise HTTPException(status_code=404, detail="Not found")
    return module


MODULE_PATH = Depends(valid_module)


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

    # This endpoint is public, so never trust file_url to stay inside uploads.
    # Take only the basename and confirm the resolved path lives under the
    # uploads root; a traversal value (e.g. "/../../etc/passwd") thus 404s.
    uploads_root = os.path.realpath("uploads")
    name = os.path.basename(item.file_url)
    file_path = os.path.realpath(os.path.join(uploads_root, name))
    try:
        inside = os.path.commonpath([uploads_root, file_path]) == uploads_root
    except ValueError:
        inside = False
    if not name or not inside or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File missing on server")

    item.download_count += 1
    db.commit()
    return FileResponse(
        file_path,
        filename=item.file_name or os.path.basename(file_path),
        media_type=item.file_type or "application/octet-stream",
    )
