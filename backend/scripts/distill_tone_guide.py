#!/usr/bin/env python3
"""Distill a reusable house-style / tone guide from a corpus of example blogs.

The competitor-blog corpus is a research artifact that lives outside the app (it
is not committed and is far too large to load into the knowledge base). This
script samples a handful of articles per source, strips the scrape boilerplate,
and asks the model to summarise the *style* they share — voice, rhythm,
structure, formatting — into a compact guide the AI writer injects on every
generation. It never copies competitor facts or product names.

Usage (from the backend/ directory):

    python -m scripts.distill_tone_guide --corpus "../Competitor Blogs"            # print only
    python -m scripts.distill_tone_guide --corpus "../Competitor Blogs" --write    # save to DB

Requires OPENROUTER_API_KEY (read from backend/.env like the app does).
"""

import argparse
import asyncio
import os
import re
import sys

# Allow `python scripts/distill_tone_guide.py` as well as `-m scripts...`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import load_env  # noqa: E402  (also applies .env side effects)

PER_SOURCE_DEFAULT = 4
PER_FILE_CHARS = 3500
SEPARATOR_RE = re.compile(r"^=+\s*$")
NAV_RE = re.compile(r"^\s*[•·]\s")

DISTILL_PROMPT = """You are a writing-style analyst. Below are excerpts from real blog
articles published by companies in the EHS / chemical-safety / compliance space.

Study the writing STYLE they share and produce a concise house-style guide that another
writer could follow to match their voice. Cover: point of view and voice; sentence
rhythm; how articles open and close; section/heading structure; use of lists, bold and
short paragraphs; how technical terms and statistics are handled; recurring transitions
and ways of addressing the reader.

Rules:
- Describe STYLE only. Do NOT include any facts, statistics, claims, company names or
  product names from the excerpts — the guide must be brand-neutral and reusable.
- Write it as direct, imperative instructions ("Open with...", "Keep paragraphs to...").
- Use short markdown sections with bullet points. Aim for 300-600 words. No preamble.

EXCERPTS:
{corpus}"""


def clean(text: str) -> str:
    """Drop the scrape header block and nav cruft; collapse duplicate lines."""
    lines = text.splitlines()

    # The files lead with TITLE:/URL:/SOURCE: then a ==== rule. Skip past the
    # first separator rule so we start at the article body.
    start = 0
    for i, line in enumerate(lines[:15]):
        if SEPARATOR_RE.match(line):
            start = i + 1
            break

    out, prev = [], None
    for line in lines[start:]:
        stripped = line.strip()
        if SEPARATOR_RE.match(line) or NAV_RE.match(line):
            continue
        if stripped in {"Home", "Blog", "Industry Insights", "Key takeaways"}:
            continue
        if stripped and stripped == prev:  # scrapes often duplicate each line
            continue
        out.append(line)
        prev = stripped

    body = "\n".join(out).strip()
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body[:PER_FILE_CHARS]


def sample_corpus(root: str, per_source: int) -> str:
    if not os.path.isdir(root):
        sys.exit(f"Corpus directory not found: {root}")

    chunks = []
    for source in sorted(os.listdir(root)):
        src_dir = os.path.join(root, source)
        if not os.path.isdir(src_dir):
            continue
        files = sorted(f for f in os.listdir(src_dir) if f.endswith(".txt"))
        # Spread the sample across the listing rather than taking the first N.
        step = max(1, len(files) // per_source)
        picked = files[::step][:per_source]
        for name in picked:
            try:
                with open(os.path.join(src_dir, name), encoding="utf-8", errors="replace") as fh:
                    body = clean(fh.read())
            except OSError:
                continue
            if len(body) > 400:
                chunks.append(f"--- {source} ---\n{body}")
    if not chunks:
        sys.exit("No usable text found in the corpus.")
    print(f"Sampled {len(chunks)} articles from {root}", file=sys.stderr)
    return "\n\n".join(chunks)


async def distill(corpus: str) -> str:
    from app.openrouter import chat

    content, model = await chat(
        [{"role": "user", "content": DISTILL_PROMPT.format(corpus=corpus)}],
        timeout=300,
    )
    print(f"Distilled with {model}", file=sys.stderr)
    return content.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", default="../Competitor Blogs", help="path to the blog corpus")
    parser.add_argument(
        "--per-source", type=int, default=PER_SOURCE_DEFAULT, help="articles to sample per source"
    )
    parser.add_argument("--write", action="store_true", help="save the guide to the settings table")
    args = parser.parse_args()

    load_env()
    corpus = sample_corpus(args.corpus, args.per_source)
    guide = asyncio.run(distill(corpus))

    print(guide)

    if args.write:
        from app.database import SessionLocal
        from app.models import TONE_GUIDE_KEY
        from app.settings_store import set_setting

        db = SessionLocal()
        try:
            set_setting(db, TONE_GUIDE_KEY, guide)
        finally:
            db.close()
        print("\n[saved to settings.tone_guide]", file=sys.stderr)


if __name__ == "__main__":
    main()
