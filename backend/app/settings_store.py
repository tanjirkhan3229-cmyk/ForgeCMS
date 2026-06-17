"""Tiny helpers for reading/writing the key/value ``settings`` table."""

from datetime import datetime

from sqlalchemy.orm import Session

from .models import Setting


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> Setting:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
    else:
        row = Setting(key=key, value=value)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
