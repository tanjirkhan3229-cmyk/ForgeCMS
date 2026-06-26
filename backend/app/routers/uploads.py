import os
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .auth import require_role

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = "uploads"
MAX_SIZE = 50 * 1024 * 1024  # 50 MB

BLOCKED_EXTENSIONS = {".exe", ".sh", ".bat", ".cmd", ".com", ".scr", ".ps1"}


@router.post("", dependencies=[Depends(require_role("admin", "editor"))])
async def upload_file(file: UploadFile = File(...)):
    original = file.filename or "file"
    ext = os.path.splitext(original)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="File type not allowed")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", os.path.splitext(original)[0])[:60]
    stored = f"{safe_stem}-{uuid.uuid4().hex[:8]}{ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f:
        f.write(data)

    return {
        "url": f"/uploads/{stored}",
        "file_name": original,
        "file_size": len(data),
        "file_type": file.content_type or "application/octet-stream",
    }
