import asyncio
import os
from contextlib import asynccontextmanager


def load_env(path: str = ".env"):
    """Minimal .env loader; real env vars always win."""
    if not os.path.isfile(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


load_env()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import admin, ai, auth, knowledge, media, public, settings, uploads
from .scheduler import scheduler_loop

Base.metadata.create_all(bind=engine)


def migrate_schema():
    """Add columns that create_all won't add to pre-existing tables."""
    from sqlalchemy import inspect, text

    added = {
        "content_items": {
            "meta_title": "VARCHAR(300) DEFAULT '' NOT NULL",
            "meta_description": "TEXT DEFAULT '' NOT NULL",
            "schema_code": "TEXT DEFAULT '' NOT NULL",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in added.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


migrate_schema()


def seed_tone_guide():
    """Populate the default house-style guide on first run only.

    Seeding when the row is absent (rather than when it's empty) means an admin
    who clears the guide in the UI keeps it cleared across restarts.
    """
    from .database import SessionLocal
    from .default_tone_guide import DEFAULT_TONE_GUIDE
    from .models import TONE_GUIDE_KEY, Setting

    db = SessionLocal()
    try:
        exists = db.query(Setting).filter(Setting.key == TONE_GUIDE_KEY).first()
        if not exists:
            db.add(Setting(key=TONE_GUIDE_KEY, value=DEFAULT_TONE_GUIDE))
            db.commit()
    finally:
        db.close()


seed_tone_guide()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title="ForgeCMS API", version="1.0.0", lifespan=lifespan)

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "https://www.forgesop.com,https://forgesop.com"
)
cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HardenedStaticFiles(StaticFiles):
    """Serve /uploads defensively.

    Even though uploads are extension-allowlisted on the way in, we harden the
    way out too: ``X-Content-Type-Options: nosniff`` stops a browser from
    MIME-sniffing a file into executable markup, and non-image files are sent
    as ``attachment`` so a stored document can never render in the app origin.
    """

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        ext = os.path.splitext(path)[1].lower()
        if ext not in uploads.IMAGE_EXTENSIONS:
            response.headers["Content-Disposition"] = "attachment"
        return response


os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", HardenedStaticFiles(directory="uploads"), name="uploads")

@app.get("/api/health")
def health():
    return {"status": "ok"}


def mount_spa(app: FastAPI):
    """Serve the built admin/public frontend (SPA) when a dist dir is present.

    Registered after all API routes, so /api/* and /uploads/* keep priority.
    Unknown paths fall back to index.html for client-side routing.
    """
    from fastapi.responses import FileResponse

    dist = os.environ.get("FRONTEND_DIST", "static")
    index = os.path.join(dist, "index.html")
    if not os.path.isfile(index):
        return

    dist_root = os.path.realpath(dist)

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path:
            # Resolve the real path and confirm it stays inside dist_root, so a
            # URL-encoded ".." (e.g. /..%2f.env) can't escape the dist dir and
            # leak secrets. os.path.commonpath raises ValueError for paths on
            # different drives/roots — treat that as an escape too.
            candidate = os.path.realpath(os.path.join(dist_root, full_path))
            try:
                inside = os.path.commonpath([dist_root, candidate]) == dist_root
            except ValueError:
                inside = False
            if inside and os.path.isfile(candidate):
                return FileResponse(candidate)
        return FileResponse(index)


# The health route and admin routes must be registered before the public
# router: its /api/{module} path would otherwise capture them, and FastAPI
# matches routes in declaration order.
from fastapi import Depends

admin_guard = [Depends(auth.require_auth)]

app.include_router(auth.router)
app.include_router(uploads.router, dependencies=admin_guard)
app.include_router(ai.router, dependencies=admin_guard)
# media, settings and knowledge must precede the admin router: its
# /api/admin/{module} pattern would otherwise capture (and 422) their paths.
app.include_router(media.router, dependencies=admin_guard)
app.include_router(settings.router, dependencies=admin_guard)
app.include_router(knowledge.router, dependencies=admin_guard)
app.include_router(admin.router, dependencies=admin_guard)
app.include_router(public.router)

mount_spa(app)
