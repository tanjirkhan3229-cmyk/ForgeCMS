import json
import os
import re
from typing import List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai", tags=["ai"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-5.4"

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
    "knowledgebase": "a structured knowledge-base article with step-by-step guidance where appropriate",
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


class GenerateIn(BaseModel):
    prompt: str
    module: str = "blogs"
    tone: str = "professional"
    length: str = "medium"


class GenerateOut(BaseModel):
    title: str = ""
    excerpt: str = ""
    content_html: str = ""
    meta_title: str = ""
    meta_description: str = ""
    tags: List[str] = []
    model: str = ""


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
async def generate(payload: GenerateIn):
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI writer is not configured: set OPENROUTER_API_KEY in backend/.env",
        )
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required")

    model = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)
    system = SYSTEM_PROMPT.format(
        kind=MODULE_GUIDE.get(payload.module, MODULE_GUIDE["blogs"]),
        tone=payload.tone,
        length=LENGTH_GUIDE.get(payload.length, LENGTH_GUIDE["medium"]),
    )

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": payload.prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "X-Title": "ForgeCMS AI Writer",
                },
                json=body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach OpenRouter: {exc}")

    if response.status_code != 200:
        detail = response.text[:300]
        try:
            detail = response.json()["error"]["message"]
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {detail}")

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response shape from OpenRouter")

    try:
        data = extract_json(content)
    except json.JSONDecodeError:
        # Model ignored the JSON instruction — salvage the text as body HTML.
        paragraphs = "".join(f"<p>{p.strip()}</p>" for p in content.split("\n\n") if p.strip())
        return GenerateOut(content_html=paragraphs, model=model)

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
        model=model,
    )
