from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated

from pydantic import BaseModel, Field, model_validator, BeforeValidator

WIB = timezone(timedelta(hours=7))


def _parse_datetime(v: object) -> datetime:
    """
    Accept "d-m-Y H:i:s" (e.g. "30-07-2026 18:00:00") or ISO 8601.
    Returns a timezone-naive datetime in WIB (Asia/Jakarta, UTC+7).
    Naive input → kept as-is (assumed WIB).
    Aware input → converted to WIB, then stripped.
    """
    if isinstance(v, datetime):
        return v.replace(tzinfo=None) if v.tzinfo else v
    if not isinstance(v, str):
        raise ValueError("datetime must be a string")
    v = v.strip()

    for fmt in ("%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%d-%m-%Y"):
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            pass

    try:
        dt = datetime.fromisoformat(v)
        return dt.astimezone(WIB).replace(tzinfo=None) if dt.tzinfo else dt
    except ValueError:
        pass

    raise ValueError("Gunakan format 'd-m-Y H:i:s', contoh '30-07-2026 18:00:00'")


def _fmt_dt(dt: datetime | None) -> str | None:
    return dt.strftime("%d-%m-%Y %H:%M:%S") if dt else None


FlexDatetime = Annotated[datetime, BeforeValidator(_parse_datetime)]


class FormCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    type: str = "form"
    require_login: bool = False
    submission_limit: str = "unlimited"
    show_leaderboard: bool = False
    is_restricted: bool = False
    show_in_history: bool = True
    reveal_score: bool = True
    reveal_answers: bool = True

    @model_validator(mode="after")
    def validate_enums(self):
        if self.type not in ("form", "quiz"):
            raise ValueError("type must be 'form' or 'quiz'")
        if self.submission_limit not in ("unlimited", "once"):
            raise ValueError("submission_limit must be 'unlimited' or 'once'")
        return self


class FormUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    type: Optional[str] = None
    require_login: Optional[bool] = None
    submission_limit: Optional[str] = None
    theme_color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    thank_you_message: Optional[str] = None
    timer_seconds: Optional[int] = Field(None, ge=30, le=86400)
    starts_at: Optional[FlexDatetime] = None
    ends_at: Optional[FlexDatetime] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    show_leaderboard: Optional[bool] = None
    is_restricted: Optional[bool] = None
    show_in_history: Optional[bool] = None
    reveal_score: Optional[bool] = None
    reveal_answers: Optional[bool] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_enums(self):
        if "type" in self.model_fields_set and self.type not in ("form", "quiz"):
            raise ValueError("type must be 'form' or 'quiz'")
        if "submission_limit" in self.model_fields_set and self.submission_limit not in ("unlimited", "once"):
            raise ValueError("submission_limit must be 'unlimited' or 'once'")
        if "status" in self.model_fields_set and self.status not in ("draft", "published", "closed"):
            raise ValueError("status must be 'draft', 'published', or 'closed'")
        return self

    @model_validator(mode="after")
    def validate_dates(self):
        if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
            raise ValueError("starts_at must be before ends_at")
        return self


class FormPublishRequest(BaseModel):
    status: str = "published"

    @model_validator(mode="after")
    def validate_status(self):
        if self.status not in ("published", "draft"):
            raise ValueError("status must be 'published' or 'draft'")
        return self


class FormPublishResponse(BaseModel):
    message: str
    short_code: str


class MessageResponse(BaseModel):
    message: str
    id: int | None = None


class FormListItem(BaseModel):
    id: int
    title: str
    type: str
    status: str
    short_code: str

    model_config = {"from_attributes": True}


class FormListResponse(BaseModel):
    data: list[FormListItem]
    meta: dict
