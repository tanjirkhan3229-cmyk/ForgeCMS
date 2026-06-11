"""Credential auth for the admin studio.

Stateless signed tokens (HMAC over email + expiry) — no extra dependencies.
The signing secret comes from SECRET_KEY env, falling back to a key persisted
next to the database so sessions survive restarts.

Bootstrap: ADMIN_EMAIL + ADMIN_PASSWORD env upsert an active admin on startup
(password is re-synced to the env value each boot, so rotating the env var in
the host rotates the credential). Without those vars, if no user can log in,
a random password is generated for admin@forgesop.com and printed once to the
server log.
"""

import base64
import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

TOKEN_TTL_SECONDS = 7 * 24 * 3600
PBKDF2_ITERATIONS = 200_000


def _load_secret() -> bytes:
    env = os.environ.get("SECRET_KEY")
    if env:
        return env.encode()
    path = os.environ.get("SECRET_KEY_FILE", ".forgecms-secret")
    try:
        if os.path.isfile(path):
            with open(path, "rb") as f:
                return f.read()
        key = secrets.token_bytes(32)
        with open(path, "wb") as f:
            f.write(key)
        return key
    except OSError:
        # Read-only filesystem: sessions won't survive restarts, but auth works.
        return secrets.token_bytes(32)


SECRET = _load_secret()


# ---------- password hashing (PBKDF2, stdlib only) ----------


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), int(iterations)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


# ---------- tokens ----------


def make_token(email: str) -> str:
    payload = f"{email}|{int(time.time()) + TOKEN_TTL_SECONDS}"
    sig = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def parse_token(token: str) -> Optional[str]:
    """Return the email if the token is valid and unexpired, else None."""
    try:
        payload = base64.urlsafe_b64decode(token.encode()).decode()
        email, expiry, sig = payload.rsplit("|", 2)
        expected = hmac.new(SECRET, f"{email}|{expiry}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        if int(expiry) < time.time():
            return None
        return email
    except (ValueError, UnicodeDecodeError):
        return None


def require_auth(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    email = parse_token(token) if token else None
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter(User.email == email, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ---------- bootstrap ----------


def bootstrap_admin():
    db = SessionLocal()
    try:
        email = os.environ.get("ADMIN_EMAIL")
        password = os.environ.get("ADMIN_PASSWORD")
        if email and password:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(name="Admin", email=email, role="admin", status="active")
                db.add(user)
            user.role = "admin"
            user.status = "active"
            user.password_hash = hash_password(password)
            db.commit()
            return

        has_login = (
            db.query(User)
            .filter(User.password_hash != "", User.status == "active")
            .first()
        )
        if has_login:
            return
        generated = secrets.token_urlsafe(12)
        email = "admin@forgesop.com"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(name="Admin", email=email, role="admin", status="active")
            db.add(user)
        user.status = "active"
        user.password_hash = hash_password(generated)
        db.commit()
        print(
            f"[auth] No login credentials found — created admin '{email}' "
            f"with password: {generated}\n"
            "[auth] Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to control this.",
            flush=True,
        )
    finally:
        db.close()


# ---------- endpoints ----------


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    status: str
    avatar_url: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    from sqlalchemy import func

    user = (
        db.query(User)
        .filter(func.lower(User.email) == payload.email.strip().lower(), User.status == "active")
        .first()
    )
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return LoginOut(token=make_token(user.email), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_auth)):
    return user


@router.post("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordIn,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user
