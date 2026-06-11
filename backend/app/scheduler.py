import asyncio
import logging
from datetime import datetime

from .database import SessionLocal
from .models import ContentItem

logger = logging.getLogger("forge.scheduler")

CHECK_INTERVAL_SECONDS = 30


def publish_due_items() -> int:
    """Flip scheduled items whose publish time has passed to published."""
    db = SessionLocal()
    try:
        due = (
            db.query(ContentItem)
            .filter(
                ContentItem.status == "scheduled",
                ContentItem.publish_at <= datetime.utcnow(),
            )
            .all()
        )
        for item in due:
            item.status = "published"
            item.published_at = item.publish_at
            logger.info("Auto-published %s/%s (id=%s)", item.module, item.slug, item.id)
        if due:
            db.commit()
        return len(due)
    finally:
        db.close()


async def scheduler_loop():
    while True:
        try:
            publish_due_items()
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
