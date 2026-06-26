from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ROLES, TONE_GUIDE_KEY, USER_STATUSES, Profile, Setting, User
from ..settings_store import set_setting
from .auth import require_role

router = APIRouter(prefix="/api/admin/settings", tags=["settings"])

# Profile writes and all user management are admin-only.
admin_only = [Depends(require_role("admin"))]


class ProfileIn(BaseModel):
    display_name: str = ""
    email: str = ""
    title: str = ""
    bio: str = ""
    avatar_url: str = ""


class ProfileOut(ProfileIn):
    model_config = ConfigDict(from_attributes=True)

    updated_at: Optional[datetime] = None


def get_or_create_profile(db: Session) -> Profile:
    profile = db.query(Profile).first()
    if not profile:
        profile = Profile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/profile", response_model=ProfileOut)
def read_profile(db: Session = Depends(get_db)):
    return get_or_create_profile(db)


@router.put("/profile", response_model=ProfileOut, dependencies=admin_only)
def update_profile(payload: ProfileIn, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


# ---------- Tone / house-style guide ----------


class ToneGuideIn(BaseModel):
    value: str = ""


class ToneGuideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    value: str = ""
    updated_at: Optional[datetime] = None


@router.get("/tone-guide", response_model=ToneGuideOut)
def read_tone_guide(db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == TONE_GUIDE_KEY).first()
    return ToneGuideOut(value=row.value if row else "", updated_at=row.updated_at if row else None)


@router.put("/tone-guide", response_model=ToneGuideOut)
def update_tone_guide(payload: ToneGuideIn, db: Session = Depends(get_db)):
    row = set_setting(db, TONE_GUIDE_KEY, payload.value.strip())
    return ToneGuideOut(value=row.value, updated_at=row.updated_at)


# ---------- User management ----------


class UserIn(BaseModel):
    name: str
    email: str
    role: str = "author"
    status: str = "active"
    avatar_url: str = ""


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    status: str
    avatar_url: str
    created_at: datetime
    updated_at: datetime


def validate_user_fields(
    db: Session,
    email: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    exclude_id: Optional[int] = None,
):
    if role is not None and role not in ROLES:
        raise HTTPException(status_code=422, detail=f"Role must be one of: {', '.join(ROLES)}")
    if status is not None and status not in USER_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"Status must be one of: {', '.join(USER_STATUSES)}"
        )
    if email is not None:
        if "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(status_code=422, detail="Invalid email address")
        q = db.query(User).filter(User.email == email)
        if exclude_id is not None:
            q = q.filter(User.id != exclude_id)
        if q.first():
            raise HTTPException(status_code=409, detail="A user with this email already exists")


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post("/users", response_model=UserOut, status_code=201, dependencies=admin_only)
def create_user(payload: UserIn, db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Name is required")
    validate_user_fields(db, email=payload.email, role=payload.role, status=payload.status)
    user = User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut, dependencies=admin_only)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    validate_user_fields(
        db,
        email=data.get("email"),
        role=data.get("role"),
        status=data.get("status"),
        exclude_id=user_id,
    )
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204, dependencies=admin_only)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
