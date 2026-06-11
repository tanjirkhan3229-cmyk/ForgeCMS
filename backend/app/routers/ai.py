import json
import re
from typing import List, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import KnowledgeDoc
from ..openrouter import chat

router = APIRouter(prefix="/api/ai", tags=["ai"])

CONTEXT_CHAR_BUDGET = 9000
MAX_SOURCES = 3

LENGTH_GUIDE = {
    "short": "300-500 words",
    "medium": "700-1000 words",
    "long": "1500-2000 words",
}

MODULE_GUIDE = {
    "blogs": "an engaging blog post with a strong hook and practical takeaways",
    "news": "a concise news article in journalistic style (inverted pyramid)",
    "resources": "a descriptive overview page for a downloadable resource, explaining what it contains and who it is for",
    "faqs": "a clear, direct answer to the question, written for a help-center audience",
}

SYSTEM_PROMPT = """You are an expert content writer for a CMS. Write {kind}.
Tone: {tone}. Target length: {length}.

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly these keys:
- "title": a compelling title (plain text, no quotes inside)
- "excerpt": a 1-2 sentence summary
- "content_html": the article body as clean semantic HTML. Use <h2>/<h3> for sections, <p>, <ul>/<ol>, <strong>, <em>, <blockquote> where appropriate. Never include <h1>, <html>, <head> or <body> tags.
- "meta_title": an SEO title, max 60 characters
- "meta_description": an SEO description, max 160 characters
- "tags": an array of 3-6 lowercase topic tags"""

KNOWLEDGE_PREAMBLE = """

You have access to the workspace knowledge base below. Treat it as the authoritative
source: ground facts, terminology, product names and procedures in it, and prefer it
over your general knowledge whenever they conflict. Do not invent details that
contradict it.

WORKSPACE KNOWLEDGE BASE:
{context}"""


class GenerateIn(BaseModel):
    prompt: str
    module: str = "blogs"
    tone: str = "professional"
    length: str = "medium"
    use_knowledge: bool = True


class GenerateOut(BaseModel):
    title: str = ""
    excerpt: str = ""
    content_html: str = ""
    meta_title: str = ""
    meta_description: str = ""
    tags: List[str] = []
    sources: List[str] = []
    model: str = ""


def select_relevant(db: Session, prompt: str) -> Tuple[str, List[str]]:
    """Pick the knowledge docs most relevant to the prompt by term overlap."""
    docs = db.query(KnowledgeDoc).all()
    if not docs:
        return "", []
    words = set(re.findall(r"[a-z0-9]{3,}", prompt.lower()))
    if not words:
        return "", []

    scored = []
    for doc in docs:
        haystack = " ".join(
            [doc.content, doc.summary, " ".join(doc.keywords or []), doc.file_name]
        ).lower()
        score = sum(haystack.count(word) for word in words)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    chunks, used, budget = [], [], CONTEXT_CHAR_BUDGET
    for _, doc in scored[:MAX_SOURCES]:
        if budget <= 0:
            break
        chunk = doc.content[:budget]
        chunks.append(f"--- Source: {doc.file_name} ---\n{chunk}")
        used.append(doc.file_name)
        budget -= len(chunk)
    return "\n\n".join(chunks), used


def extract_json(text: str) -> dict:
    """Parse the model output, tolerating markdown fences or stray prose."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


@router.post("/generate", response_model=GenerateOut)
async def generate(payload: GenerateIn, db: Session = Depends(get_db)):
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required")

    system = SYSTEM_PROMPT.format(
        kind=MODULE_GUIDE.get(payload.module, MODULE_GUIDE["blogs"]),
        tone=payload.tone,
        length=LENGTH_GUIDE.get(payload.length, LENGTH_GUIDE["medium"]),
    )

    sources: List[str] = []
    if payload.use_knowledge:
        context, sources = select_relevant(db, payload.prompt)
        if context:
            system += KNOWLEDGE_PREAMBLE.format(context=context)

    content, model = await chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": payload.prompt},
        ]
    )

    try:
        data = extract_json(content)
    except json.JSONDecodeError:
        # Model ignored the JSON instruction — salvage the text as body HTML.
        paragraphs = "".join(f"<p>{p.strip()}</p>" for p in content.split("\n\n") if p.strip())
        return GenerateOut(content_html=paragraphs, sources=sources, model=model)

    tags = data.get("tags", [])
    if not isinstance(tags, list):
        tags = []
    return GenerateOut(
        title=str(data.get("title", "")),
        excerpt=str(data.get("excerpt", "")),
        content_html=str(data.get("content_html", "")),
        meta_title=str(data.get("meta_title", "")),
        meta_description=str(data.get("meta_description", "")),
        tags=[str(t) for t in tags],
        sources=sources,
        model=model,
    )
