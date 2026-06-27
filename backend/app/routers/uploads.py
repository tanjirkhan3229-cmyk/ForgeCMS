import os
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .auth import require_role

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = "uploads"
MAX_SIZE = 50 * 1024 * 1024  # 50 MB
CHUNK_SIZE = 1024 * 1024  # 1 MB

BLOCKED_EXTENSIONS = {".exe", ".sh", ".bat", ".cmd", ".com", ".scr", ".ps1"}


@router.post("", dependencies=[Depends(require_role("admin", "editor"))])
async def upload_file(file: UploadFile = File(...)):
    original = file.filename or "file"
    ext = os.path.splitext(original)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
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
