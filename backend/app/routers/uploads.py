import os
import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from .auth import require_role

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = "uploads"
MAX_SIZE = 50 * 1024 * 1024  # 50 MB
CHUNK_SIZE = 1024 * 1024  # 1 MB

# Uploads are served from the app origin via StaticFiles, so a stored file that
# a browser will execute as markup (.html, .svg, .xml, ...) would run script in
# our own origin and could read the localStorage auth token. We therefore use
# allowlists, never a denylist: only inert, non-executable types are accepted.
#
# Raster images only — notably NOT .svg, which is XML a browser will script.
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"}

# Documents/archives that browsers do not execute. Explicitly excludes
# html/htm/svg/xml/xhtml and any script type.
RESOURCE_EXTENSIONS = {
    ".pdf",
    ".doc", ".docx",
    ".xls", ".xlsx",
    ".ppt", ".pptx",
    ".odt", ".ods", ".odp",
    ".csv", ".txt", ".md", ".rtf",
    ".zip",
}

# Allowlist applied per upload context. "any" (the media library, which accepts
# both images and documents) is the union of the two safe sets.
ALLOWED_BY_KIND = {
    "image": IMAGE_EXTENSIONS,
    "resource": RESOURCE_EXTENSIONS,
    "any": IMAGE_EXTENSIONS | RESOURCE_EXTENSIONS,
}


@router.post("", dependencies=[Depends(require_role("admin", "editor"))])
async def upload_file(file: UploadFile = File(...), kind: str = Form("any")):
    allowed = ALLOWED_BY_KIND.get(kind)
    if allowed is None:
        raise HTTPException(status_code=422, detail="Unknown upload kind")

    original = file.filename or "file"
    ext = os.path.splitext(original)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=422, detail="File type not allowed")

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", os.path.splitext(original)[0])[:60]
    stored = f"{safe_stem}-{uuid.uuid4().hex[:8]}{ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Stream to disk in fixed chunks, enforcing the cap as we go so an
    # oversized upload is rejected without ever buffering it all in memory.
    dest = os.path.join(UPLOAD_DIR, stored)
    total = 0
    try:
        with open(dest, "wb") as f:
            while chunk := await file.read(CHUNK_SIZE):
                total += len(chunk)
                if total > MAX_SIZE:
                    raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")
                f.write(chunk)
    except HTTPException:
        if os.path.exists(dest):
            os.remove(dest)
        raise

    return {
        "url": f"/uploads/{stored}",
        "file_name": original,
        "file_size": total,
        "file_type": file.content_type or "application/octet-stream",
    }
