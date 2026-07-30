from typing import Optional

from pydantic import BaseModel, Field


class ProfileUpdateRequest(BaseModel):
    """Keeps the schema for reference; avatar upload uses POST /me/avatar (multipart)."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar: Optional[str] = None
