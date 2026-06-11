# ForgeCMS

A headless CMS with a FastAPI backend and a React (Vite) frontend. Four content
modules — **Blogs**, **News**, **Downloadable Resources**, and **FAQ Articles** —
each with drafts, published content, scheduled publishing, and a full-featured
TipTap rich text editor.

## Stack

- **Backend** — FastAPI + SQLAlchemy + SQLite (`backend/`), file uploads served
  from `backend/uploads/`, background scheduler auto-publishes scheduled items
  every 30 seconds.
- **Frontend** — React 19 + Vite + TypeScript + Tailwind CSS 4 (`frontend/`),
  TipTap v2 editor, React Router. The dev server proxies `/api` and `/uploads`
  to the backend.

## Running locally

Backend (port 8000):

```bash
cd backend
python3 -m venv .venv            # first time only
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

Frontend (port 5173):

```bash
cd frontend
npm install                      # first time only
npm run dev
```

- Public site: http://localhost:5173 (blog, news, resources, FAQ)
- Admin studio: http://localhost:5173/admin
- API docs (Swagger): http://localhost:8000/docs

## API overview

| Route | Purpose |
| --- | --- |
| `GET/POST /api/admin/{module}` | List (filter by `status`, `search`) / create. `module` ∈ `blogs, news, resources, faqs` |
| `GET/PUT/DELETE /api/admin/{module}/{id}` | Read / update / delete one item |
| `POST /api/admin/{module}/{id}/publish` · `/unpublish` · `/schedule` · `/duplicate` | Status transitions (`schedule` takes `{"publish_at": "<UTC ISO>"}`) |
| `GET /api/admin/{module}/stats` | Draft/scheduled/published counts |
| `GET /api/{module}` | Public list — published items only (`search`, `category`, paging) |
| `GET /api/{module}/slug/{slug}` | Public detail by slug |
| `GET /api/{module}/categories` | Distinct categories in published items |
| `GET /api/resources/{id}/download` | Download a resource file (increments counter) |
| `POST /api/uploads` | Multipart file upload (images, resource files) — returns `{url, file_name, file_size, file_type}` |

All timestamps are stored as naive UTC; the frontend converts to/from local
time for display and the schedule picker.

## Content model

One shared `content_items` table across all modules: title, slug (unique per
module), excerpt, TipTap JSON (`content`) plus rendered HTML (`content_html`),
cover image, category, tags, author, status (`draft | scheduled | published`),
`publish_at`, and resource file metadata (`file_url`, `file_name`, `file_size`,
`file_type`, `download_count`).

## Editor

The TipTap editor includes: headings, bold/italic/underline/strike, inline code,
highlight, sub/superscript, text color, font family, text alignment,
bullet/ordered/task lists, blockquotes, syntax-highlighted code blocks, tables
(with row/column controls), links, image upload, YouTube embeds, horizontal
rules, undo/redo, clear formatting, and a word/character counter.

## Notes

- There is no authentication yet — add auth before exposing the admin API
  beyond localhost.
- SQLite is fine for a single instance; swap `DATABASE_URL` in
  `backend/app/database.py` for Postgres in production.
