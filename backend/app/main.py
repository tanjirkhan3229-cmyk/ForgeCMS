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
from .routers import admin, ai, media, public, settings, uploads
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
        }
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in added.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


migrate_schema()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title="ForgeCMS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/api/health")
def health():
    return {"status": "ok"}


# The health route and admin routes must be registered before the public
# router: its /api/{module} path would otherwise capture them, and FastAPI
# matches routes in declaration order.
app.include_router(uploads.router)
app.include_router(ai.router)
# media and settings must precede the admin router: its /api/admin/{module}
# pattern would otherwise capture (and 422) /api/admin/media and /settings.
app.include_router(media.router)
app.include_router(settings.router)
app.include_router(admin.router)
app.include_router(public.router)
