"""Tests for server-side HTML sanitization of editor content.

Run with:  cd backend && pip install -r requirements.txt pytest && pytest
"""

from app.sanitize import sanitize_html


# --- Malicious payloads are neutralized -------------------------------------

def test_script_tag_and_body_removed():
    out = sanitize_html("<p>hello</p><script>alert('xss')</script>")
    assert out == "<p>hello</p>"
    assert "script" not in out and "alert" not in out


def test_img_onerror_handler_stripped_src_kept():
    out = sanitize_html('<img src="/uploads/a.png" onerror="alert(document.cookie)">')
    assert 'src="/uploads/a.png"' in out
    assert "onerror" not in out and "alert" not in out


def test_inline_event_handlers_stripped():
    out = sanitize_html('<p onclick="steal()" onmouseover="x()">text</p>')
    assert out == "<p>text</p>"
    assert "onclick" not in out and "onmouseover" not in out


def test_javascript_url_dropped():
    out = sanitize_html('<a href="javascript:alert(1)">click</a>')
    assert "javascript:" not in out and "alert" not in out


def test_data_uri_image_dropped():
    out = sanitize_html('<img src="data:text/html,<script>alert(1)</script>">')
    assert "data:text/html" not in out and "script" not in out


def test_svg_with_onload_removed():
    out = sanitize_html('<svg onload="alert(1)"><rect /></svg>')
    assert "svg" not in out and "onload" not in out


def test_iframe_from_untrusted_host_loses_src():
    out = sanitize_html('<iframe src="https://evil.example/phish"></iframe>')
    assert "evil.example" not in out


def test_style_block_removed():
    out = sanitize_html("<style>body{display:none}</style><p>ok</p>")
    assert "<style" not in out and "display:none" not in out
    assert "<p>ok</p>" in out


# --- Legitimate TipTap output survives --------------------------------------

def test_formatting_preserved():
    html = "<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p>"
    assert sanitize_html(html) == html


def test_lists_preserved():
    html = "<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>"
    assert sanitize_html(html) == html


def test_uploaded_image_relative_url_survives():
    out = sanitize_html('<img src="/uploads/pic-abcd1234.png" alt="cover">')
    assert 'src="/uploads/pic-abcd1234.png"' in out
    assert 'alt="cover"' in out


def test_safe_link_kept_and_hardened():
    out = sanitize_html('<a href="https://example.com" title="t">link</a>')
    assert 'href="https://example.com"' in out
    assert ">link</a>" in out
    assert 'rel="noopener noreferrer nofollow"' in out  # nh3-managed rel


def test_table_blockquote_code_preserved():
    html = (
        "<blockquote>q</blockquote><pre><code>x = 1</code></pre>"
        '<table><tbody><tr><td colspan="2">d</td></tr></tbody></table>'
    )
    out = sanitize_html(html)
    assert "<blockquote>q</blockquote>" in out
    assert "<code>x = 1</code>" in out
    assert "colspan" in out


def test_youtube_embed_preserved():
    html = '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe>'
    out = sanitize_html(html)
    assert 'src="https://www.youtube.com/embed/abc123"' in out
    assert "<iframe" in out


# --- Properties --------------------------------------------------------------

def test_idempotent():
    once = sanitize_html('<p>hi</p><img src="/uploads/a.png" onerror="x()">')
    assert sanitize_html(once) == once


def test_empty_passthrough():
    assert sanitize_html("") == ""
