import os
from typing import List, Tuple

import httpx
from fastapi import HTTPException

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-5.4"


async def chat(messages: List[dict], timeout: float = 300) -> Tuple[str, str]:
    """Send a chat completion to OpenRouter. Returns (content, model)."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured: set OPENROUTER_API_KEY in backend/.env",
        )
    model = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "X-Title": "ForgeCMS",
                },
                json={"model": model, "messages": messages},
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
        return response.json()["choices"][0]["message"]["content"], model
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response shape from OpenRouter")
