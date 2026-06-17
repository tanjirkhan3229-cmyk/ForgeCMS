"""Seed house-style guide distilled from the example-blog corpus.

This is a brand-neutral distillation of the *style* shared by leading EHS /
chemical-safety / compliance blogs — voice, rhythm, structure, formatting. It
contains no facts, statistics or product names. It is written into the
``settings`` table on first run and is freely editable from the admin UI; the
distill_tone_guide.py script can regenerate it from the corpus later.
"""

DEFAULT_TONE_GUIDE = """\
# House writing style

Write practitioner-facing explainer articles for an EHS / chemical-safety /
compliance audience. Sound like an experienced expert helping a busy safety or
compliance lead get something done — authoritative but approachable, never academic.

## Voice
- Address the reader directly as "you/your" and cast them as the responsible party
  (the manager, employer, safety lead). Keep it the spine of the piece.
- Use "we" only editorially ("In this article, we break down…"), not personally.
- Be confident and helpful. A light contrarian framing works well: set up what
  "most organizations" get wrong, then show the better way.

## Structure
Follow this arc: hook → name the problem → why it persists → the cost of inaction →
the proactive fix → a forward-looking takeaway.
- Open with stakes, a counterintuitive thesis, or a brief real-world scenario, then
  add one short roadmap sentence telling the reader what they'll learn.
- Lead with a short "Key takeaways" or "TL;DR" bullet box summarising the article.
- Use a heading every 2–4 paragraphs. Mix question headings ("What is an IDLH value?")
  with argumentative full-sentence headings ("Compliance is the starting line, not the
  finish line.").
- Favour numbered listicles and bulleted breakdowns. A short FAQ section near the end
  is welcome.
- Close with a "bottom line" summary that looks forward. Do NOT end with a product
  pitch, demo booking, or "how we can help" section.

## Rhythm
- Default to medium-length, plain declarative sentences, often opening with a
  conditional ("If…", "While…", "Whether…").
- Punctuate with the occasional short, standalone "truth" sentence on its own line for
  emphasis. Use fragments sparingly — never stack them into a choppy staccato.

## Register and formatting
- Plain English, low barrier to entry. Assume a smart reader who doesn't know every acronym.
- Define every acronym and technical term on first use, every time.
- Keep paragraphs short (1–4 sentences) with generous white space.
- Bold key terms and list lead-ins. Use questions as headings and transitions.
- Frame around risk and consequence (liability, audit failure, worker harm), but balance
  it with reassurance — don't fear-monger.
- When citing a statistic, attribute it to a named, independent source. Never invent
  numbers or use vague, unsourced figures.

## Vocabulary
Lean on the field's shared lexicon naturally: proactive vs. reactive, leading vs.
lagging indicators, near misses, safety culture, "living document", audit-ready,
best practices, "get ahead of risk", "before it becomes an incident". Useful transitions:
"The reality is", "In short", "However", "The good news?", "The takeaway:".

## Always avoid
- Product or company self-promotion, brand names, and "book a demo / contact us" CTAs —
  keep the content vendor-neutral and evergreen.
- Clickbait fear-bait, vague or fabricated statistics, and robotic fragment-stacking.
- Scraped cruft and AI tells: duplicated summary blocks, "Share this article", author
  bios, and overused clichés.
"""
