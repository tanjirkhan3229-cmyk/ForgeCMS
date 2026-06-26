# ForgeCMS

A headless CMS with a FastAPI backend and a React (Vite) frontend. Four content
modules — **Blogs**, **News**, **Downloadable Resources**, and **FAQ Articles** —
each with drafts, published content, scheduled publishing, a full-featured TipTap
rich text editor, and a knowledge-grounded AI writer powered by OpenRouter.

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
| `POST /api/ai/generate` | AI writer — `{prompt, module, tone, length, use_knowledge}` → draft JSON + `sources` via OpenRouter |
| `GET/POST /api/admin/knowledge` · `GET/DELETE /api/admin/knowledge/{id}` · `POST .../reanalyze` | Knowledge base — upload .md/.txt docs the AI grounds its drafts in |
| `GET/PUT/DELETE /api/admin/{module}/{id}` | Read / update / delete one item |
| `POST /api/admin/{module}/{id}/publish` · `/unpublish` · `/schedule` · `/duplicate` | Status transitions (`schedule` takes `{"publish_at": "<UTC ISO>"}`) |
| `GET /api/admin/{module}/stats` | Draft/scheduled/published counts |
| `GET /api/{module}` | Public list — published items only (`search`, `category`, paging) |
| `GET /api/{module}/slug/{slug}` | Public detail by slug |
| `GET /api/{module}/categories` | Distinct categories in published items |
| `GET /api/resources/{id}/download` | Download a resource file (increments counter) |
| `POST /api/uploads` | Multipart file upload (images, resource files) — returns `{url, file_name, file_size, file_type}` |
| `GET /api/admin/stats` | Per-module draft/scheduled/published counts (drives the sidebar) |
| `GET/DELETE /api/admin/media[/{name}]` | Media library — list uploads (`search`, `type=image\|file`, paging) / delete a file |
| `GET/PUT /api/admin/settings/profile` | User profile settings (name, email, title, bio, avatar) |
| `GET/POST /api/admin/settings/users` · `PUT/DELETE /api/admin/settings/users/{id}` | User management — roles (`admin, editor, author, viewer`) and status (`active, invited, suspended`) |

All timestamps are stored as naive UTC; the frontend converts to/from local
time for display and the schedule picker.

## Content model

One shared `content_items` table across all modules: title, slug (unique per
module), excerpt, TipTap JSON (`content`) plus rendered HTML (`content_html`),
cover image, category, tags, author (picked from workspace users), SEO fields
(`meta_title`, `meta_description`, `schema_code` — applied to the public page's
head as the title tag, description meta and a JSON-LD script), status
(`draft | scheduled | published`), `publish_at`, and resource file metadata
(`file_url`, `file_name`, `file_size`, `file_type`, `download_count`).

## Admin navigation

Each content module is a dropdown in the sidebar: **Create New** (opens the
editor), and **Drafts**, **Published** and **Scheduled** (3×3 tile grids with
pagination and search). The Workspace section holds the **Knowledge Base** (the
AI's grounding documents), the **Media Library** (browse, upload, copy URL,
delete all uploaded files) and **Settings**, which has two
tabs: **Profile Settings** (name, email, title, bio, avatar) and **User
Management** (add/remove team members, change roles — Admin, Editor, Author,
Viewer — and toggle status between active, invited and suspended).

## Roles & permissions

Every `/api/admin/*` and `/api/uploads` endpoint requires a valid session
token. Beyond authentication, writes are gated by role (enforced server-side
via `require_role` in `backend/app/routers/auth.py`):

| Role | Permissions |
| --- | --- |
| **Admin** | Everything, including user management and profile/settings writes |
| **Editor** | Create, edit, publish, schedule, duplicate and delete content; upload and delete media; manage the knowledge base |
| **Author** | Create and edit content only — cannot publish, schedule, duplicate or delete (content has no per-author ownership field, so authors may edit any item) |
| **Viewer** | Read-only — every GET/list endpoint, no writes |

Listing endpoints (`GET`) stay open to all authenticated roles; only writes and
deletes are restricted. A request from a role without permission returns `403`.

## Editor

The TipTap editor includes: headings, bold/italic/underline/strike, inline code,
highlight, sub/superscript, text color, font family, text alignment,
bullet/ordered/task lists, blockquotes, syntax-highlighted code blocks, tables
(with row/column controls), links, image upload, YouTube embeds, horizontal
rules, undo/redo, clear formatting, and a word/character counter.

## AI writer & knowledge base

Each editor sidebar has an **AI Writer** tab: describe the article, pick a tone
and length, and the backend asks an OpenRouter-hosted model (default
`openai/gpt-5.4`) for a structured draft — body HTML, title, excerpt, SEO meta
fields and tags. The draft fills the editor and any empty fields; existing
content is never overwritten without confirmation.

The **Knowledge Base** (Workspace section) is the AI's brain: upload `.md` or
`.txt` documents — product docs, fact sheets, style guides — and each one is
analyzed (summary + keywords) on upload. When generating, the writer selects
the documents most relevant to your prompt and grounds the draft in them,
reporting which sources it used. Toggle "Use knowledge base" in the AI tab to
opt out per generation.

Configure credentials in `backend/.env` (gitignored — see
`backend/.env.example`):

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-5.4
```

## Deploying to Railway

The repo root has a multi-stage `Dockerfile` (builds the React frontend, then
serves it and the API from one FastAPI process) and a `railway.json` with the
healthcheck preconfigured. One Railway service runs everything: the public
content API, the admin studio (`/admin`), and uploads.

1. **Create the service** — Railway → New Project → *Deploy from GitHub repo*
   → pick this repo. Railway detects the root `Dockerfile` automatically.
2. **Set variables** (service → Variables):
   - `DATABASE_URL` — the Supabase session-pooler URL (see Notes below)
   - `OPENROUTER_API_KEY` — for the AI writer
   - `OPENROUTER_MODEL` — optional, defaults to `openai/gpt-5.4`
   - `CORS_ORIGINS` — e.g. `https://www.forgesop.com,https://forgesop.com`
   (don't set `PORT` — Railway injects it and the Dockerfile honors it)
3. **Attach a volume** (service → right-click → Attach Volume) mounted at
   `/app/uploads` so uploaded images/files survive redeploys.
4. **Domain** — service → Settings → Networking: generate a Railway domain or
   attach a custom one (e.g. `api.forgesop.com` via CNAME).
5. Deploy. Health is checked at `/api/health`; tables are created in Postgres
   automatically on first boot.

The website (www.forgesop.com) then consumes `https://<your-domain>/api/...`,
and editors use `https://<your-domain>/admin`. Remember image URLs in API
responses are relative (`/uploads/...`) — prefix them with the API domain.

## Authentication

The studio root (`/`) is a login page; after signing in you land on the admin
dashboard. All admin APIs (`/api/admin/*`, `/api/uploads`, `/api/ai/*`) require
a Bearer token from `POST /api/auth/login`; the public content APIs stay open.

Credentials live in **Supabase Auth**: login proxies the password grant to
Supabase (`SUPABASE_URL` + `SUPABASE_ANON_KEY` env), and on success the backend
mints its own HMAC-signed 7-day session token (`SECRET_KEY` env — set it in
production or sessions reset on redeploy). Create/manage users and passwords in
the Supabase dashboard (Authentication → Users) or via its admin API; set
`app_metadata.forge_role` to control the role assigned on first login. Each
first login upserts the user into the local directory shown in User Management,
where role/status stay editable (suspending a user there blocks login).

## Notes

- The database defaults to local SQLite (`backend/forge.db`). Set
  `DATABASE_URL` in `backend/.env` to use Postgres — e.g. Supabase via its
  session pooler:
  `postgresql+psycopg://postgres.<project-ref>:<url-encoded-password>@aws-1-<region>.pooler.supabase.com:5432/postgres`.
  Tables are created automatically on first start. Note: Supabase's direct
  `db.<ref>.supabase.co` host is IPv6-only — use the pooler host on
  IPv4-only networks, and URL-encode special characters in the password.
