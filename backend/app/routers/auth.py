"""Supabase-backed auth for the admin studio.

Credentials live in Supabase Auth (users are created/managed there). Login
proxies the password grant to Supabase; on success the backend mints its own
HMAC-signed 7-day session token, so editors aren't logged out when Supabase's
short-lived access token expires.

On first login a row is upserted into the local users table (the directory
shown in User Management); the role comes from the Supabase user's
app_metadata.forge_role and stays editable locally afterwards.
"""

import base64
import hashlib
import hmac
import os
import secrets
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ROLES, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

TOKEN_TTL_SECONDS = 7 * 24 * 3600

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# The session lives in an httpOnly cookie so it is never readable by JavaScript
# (defeating token theft via XSS). Secure defaults on; set COOKIE_SECURE=false
# for plain-http local development if a browser refuses the cookie.
COOKIE_NAME = "forge_session"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").strip().lower() != "false"


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=TOKEN_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    # Attributes must match set_session_cookie for the browser to drop it.
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        path="/",
    )


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


# ---------- session tokens ----------


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
    session: str = Cookie(default="", alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    # Prefer the httpOnly session cookie; fall back to a Bearer header so
    # non-browser API clients (scripts, integrations) still work.
    token = session or authorization.removeprefix("Bearer ").strip()
    email = parse_token(token) if token else None
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = (
        db.query(User)
        .filter(func.lower(User.email) == email.lower(), User.status == "active")
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_role(*allowed: str):
    """Dependency factory: require an authenticated user whose role is in `allowed`.

    Use as a route dependency, e.g.
        dependencies=[Depends(require_role("admin", "editor"))]
    Read/list endpoints stay open to every authenticated role; only writes and
    deletes should be wrapped in this. Returns 403 for an authenticated user
    whose role isn't permitted.
    """

    def dep(user: User = Depends(require_auth)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dep


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


@router.post("/login", response_model=UserOut)
async def login(payload: LoginIn, resp: Response, db: Session = Depends(get_db)):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=503,
            detail="Auth is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY",
        )

    email = payload.email.strip().lower()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                json={"email": email, "password": payload.password},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach auth service: {exc}")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    supa_user = response.json().get("user") or {}
    meta_role = (supa_user.get("app_metadata") or {}).get("forge_role", "")
    meta_name = (supa_user.get("user_metadata") or {}).get("name", "")

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        user = User(
            name=meta_name or email.split("@")[0].replace(".", " ").title(),
            email=email,
            role=meta_role if meta_role in ROLES else "editor",
            status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.status != "active":
        raise HTTPException(status_code=401, detail="Account is suspended")

    # Issue the session as an httpOnly cookie rather than returning it in the
    # body, so it is never exposed to JavaScript.
    set_session_cookie(resp, make_token(user.email))
    return UserOut.model_validate(user)


@router.post("/logout", status_code=204)
def logout(resp: Response):
    clear_session_cookie(resp)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_auth)):
    return user
