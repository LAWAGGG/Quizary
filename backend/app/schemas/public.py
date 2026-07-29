from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FormPublicResponse(BaseModel):
    title: str
    description: Optional[str] = None
    type: str
    banner_path: Optional[str] = None
    theme_color: Optional[str] = None
    require_login: bool
    status: str


class CanStartResponse(BaseModel):
    can_start: bool
    form_id: Optional[int] = None
    require_identity: bool = False
    reason: Optional[str] = None
    starts_at: Optional[datetime] = None
