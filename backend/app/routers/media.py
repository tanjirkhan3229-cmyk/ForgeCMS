import mimetypes
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .auth import require_role

router = APIRouter(prefix="/api/admin/media", tags=["media"])

UPLOAD_DIR = "uploads"


class MediaFile(BaseModel):
    name: str
    url: str
    size: int
    content_type: str
    is_image: bool
    modified_at: datetime


class MediaList(BaseModel):
    items: List[MediaFile]
    total: int
    page: int
    page_size: int


def scan_uploads() -> List[MediaFile]:
    if not os.path.isdir(UPLOAD_DIR):
        return []
    files = []
    for name in os.listdir(UPLOAD_DIR):
        path = os.path.join(UPLOAD_DIR, name)
        if name.startswith(".") or not os.path.isfile(path):
            continue
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        stat = os.stat(path)
        files.append(
            MediaFile(
                name=name,
                url=f"/uploads/{name}",
                size=stat.st_size,
                content_type=content_type,
                is_image=content_type.startswith("image/"),
                modified_at=datetime.utcfromtimestamp(stat.st_mtime),
            )
        )
    files.sort(key=lambda f: f.modified_at, reverse=True)
    return files


@router.get("", response_model=MediaList)
def list_media(
    search: Optional[str] = None,
    type: Optional[str] = Query(None, pattern="^(image|file)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    files = scan_uploads()
    if search:
        needle = search.lower()
        files = [f for f in files if needle in f.name.lower()]
    if type == "image":
        files = [f for f in files if f.is_image]
    elif type == "file":
        files = [f for f in files if not f.is_image]
    total = len(files)
    start = (page - 1) * page_size
    return MediaList(
        items=files[start : start + page_size],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete(
    "/{name}",
    status_code=204,
    dependencies=[Depends(require_role("admin", "editor"))],
)
def delete_media(name: str):
    # Reject anything that is not a plain filename inside the uploads dir.
    if os.path.basename(name) != name or name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = os.path.join(UPLOAD_DIR, name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    os.remove(path)
