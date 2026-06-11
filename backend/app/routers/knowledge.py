import json
import os
import re
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import KnowledgeDoc
from ..openrouter import chat

router = APIRouter(prefix="/api/admin/knowledge", tags=["knowledge"])

ALLOWED_EXTENSIONS = {".md", ".markdown", ".txt"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB of text
ANALYSIS_CHAR_LIMIT = 12000

ANALYSIS_PROMPT = """Analyze the following document and respond with ONLY a JSON object:
{{"summary": "<2-3 sentence summary of what this document covers>", "keywords": ["5-10", "lowercase", "topic", "keywords"]}}

Document ({name}):
{content}"""


class KnowledgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    summary: str
    keywords: List[str]
    size: int
    created_at: datetime


class KnowledgeDetail(KnowledgeOut):
    content: str


async def analyze(doc: KnowledgeDoc) -> None:
    """Ask the AI for a summary + keywords. Failures leave the doc unanalyzed."""
    prompt = ANALYSIS_PROMPT.format(name=doc.file_name, content=doc.content[:ANALYSIS_CHAR_LIMIT])
    content, _ = await chat([{"role": "user", "content": prompt}], timeout=120)
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE).strip()
    data = json.loads(cleaned)
    doc.summary = str(data.get("summary", ""))
    keywords = data.get("keywords", [])
    doc.keywords = [str(k) for k in keywords] if isinstance(keywords, list) else []


@router.post("", response_model=KnowledgeOut, status_code=201)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    name = file.filename or "document.txt"
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Only .md and .txt files are supported")

    raw = await file.read()
    if len(raw) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 2 MB limit")
    text = raw.decode("utf-8", errors="replace").strip()
    if not text:
        raise HTTPException(status_code=422, detail="The file is empty")

    doc = KnowledgeDoc(file_name=name, content=text, size=len(raw))
    try:
        await analyze(doc)
    except Exception:
        # AI analysis is best-effort; the document is still usable as context.
        pass
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=List[KnowledgeOut])
def list_documents(db: Session = Depends(get_db)):
    return db.query(KnowledgeDoc).order_by(KnowledgeDoc.created_at.desc()).all()


@router.get("/{doc_id}", response_model=KnowledgeDetail)
def read_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/{doc_id}/reanalyze", response_model=KnowledgeOut)
async def reanalyze_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        await analyze(doc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}")
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
