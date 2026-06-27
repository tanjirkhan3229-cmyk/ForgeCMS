"""Server-side HTML sanitization for editor-authored content.

Public pages render ``content_html`` via ``dangerouslySetInnerHTML``, so any
markup an editor stores executes in every visitor's browser. We therefore
sanitize on write with nh3 (the Rust/ammonia allowlist sanitizer): only the
tags and attributes the TipTap editor actually produces survive, while event
handlers (``onerror`` & co.), ``<script>``/``<style>`` bodies, and
``javascript:`` URLs are stripped.
"""

from urllib.parse import urlparse

import nh3

# Tags the TipTap editor can emit. Allowlist, not denylist: anything not listed
# is unwrapped (its text is kept, the tag is dropped).
ALLOWED_TAGS = {
    "p", "br", "hr", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark",
    "a", "img",
    "blockquote", "code", "pre",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "caption", "colgroup", "col",
    "iframe",  # YouTube/Vimeo embeds — src is host-restricted in _attribute_filter
}

# Attributes permitted per tag. Crucially this omits every ``on*`` handler, so
# ``<img src=x onerror=...>`` keeps only ``src``.
ALLOWED_ATTRIBUTES = {
    # "rel" is managed by nh3 via link_rel below, so it must not be listed here.
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
    "col": {"span"},
    "colgroup": {"span"},
    "iframe": {"src", "width", "height", "title", "frameborder", "allow", "allowfullscreen"},
}

# URL schemes allowed on href/src. Excludes ``javascript:`` and ``data:`` so a
# link or image can't smuggle script or inline markup.
ALLOWED_URL_SCHEMES = {"http", "https", "mailto", "tel"}

# Hosts whose content the editor's embed feature is allowed to iframe.
ALLOWED_IFRAME_HOSTS = {
    "www.youtube.com", "youtube.com",
    "www.youtube-nocookie.com", "youtube-nocookie.com",
    "player.vimeo.com",
}


def _attribute_filter(tag: str, attr: str, value: str):
    """Drop an ``iframe`` ``src`` that doesn't point at an allowed embed host."""
    if tag == "iframe" and attr == "src":
        try:
            host = (urlparse(value).hostname or "").lower()
        except ValueError:
            return None
        return value if host in ALLOWED_IFRAME_HOSTS else None
    return value


def sanitize_html(html: str) -> str:
    """Return ``html`` with only allowlisted tags/attributes/URLs retained.

    Idempotent: re-sanitizing already-clean HTML returns it unchanged.
    """
    if not html:
        return html
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        clean_content_tags={"script", "style"},
        attribute_filter=_attribute_filter,
        url_schemes=ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer nofollow",
    )
