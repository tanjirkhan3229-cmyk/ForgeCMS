import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

# A resource file_url may only reference a file inside the uploads dir, as
# produced by POST /api/uploads ("/uploads/<stored-name>"). This blocks
# traversal payloads from ever being persisted (the public download endpoint
# also re-checks at read time).
UPLOADS_URL_RE = re.compile(r"^/uploads/[^/\\]+$")


class ContentBase(BaseModel):
    title: str = ""
    slug: str = ""
    excerpt: str = ""
    content: Dict[str, Any] = {}
    content_html: str = ""
    cover_image: str = ""
    category: str = ""
    tags: List[str] = []
    author: str = ""
    meta_title: str = ""
    meta_description: str = ""
    schema_code: str = ""
    file_url: str = ""
    file_name: str = ""
    file_size: int = 0
    file_type: str = ""

    @field_validator("file_url")
    @classmethod
    def _validate_file_url(cls, v: str) -> str:
        if v and (".." in v or not UPLOADS_URL_RE.match(v)):
            raise ValueError("file_url must be of the form /uploads/<filename>")
        return v


class ContentCreate(ContentBase):
    status: str = "draft"
    publish_at: Optional[datetime] = None


class ContentUpdate(ContentBase):
    status: Optional[str] = None
    publish_at: Optional[datetime] = None


class ContentOut(ContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module: str
    status: str
    publish_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    download_count: int = 0
    created_at: datetime
    updated_at: datetime


class ContentList(BaseModel):
    items: List[ContentOut]
    total: int
    page: int
    page_size: int


class ScheduleIn(BaseModel):
    publish_at: datetime


class StatsOut(BaseModel):
    drafts: int
    scheduled: int
    published: int
    total: int
