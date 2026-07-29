from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class FormCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    type: str = "form"
    is_public: bool = True
    require_login: bool = False
    submission_limit: str = "unlimited"

    @model_validator(mode="after")
    def validate_enums(self):
        if self.type not in ("form", "quiz"):
            raise ValueError("type harus 'form' atau 'quiz'")
        if self.submission_limit not in ("unlimited", "once"):
            raise ValueError("submission_limit harus 'unlimited' atau 'once'")
        return self


class FormUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    type: Optional[str] = None
    is_public: Optional[bool] = None
    require_login: Optional[bool] = None
    submission_limit: Optional[str] = None
    theme_color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    banner_path: Optional[str] = None
    thank_you_message: Optional[str] = None
    timer_seconds: Optional[int] = Field(None, ge=30, le=86400)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_enums(self):
        if "type" in self.model_fields_set and self.type not in ("form", "quiz"):
            raise ValueError("type harus 'form' atau 'quiz'")
        if "submission_limit" in self.model_fields_set and self.submission_limit not in ("unlimited", "once"):
            raise ValueError("submission_limit harus 'unlimited' atau 'once'")
        if "status" in self.model_fields_set and self.status not in ("draft", "published", "closed"):
            raise ValueError("status harus 'draft', 'published', atau 'closed'")
        return self

    @model_validator(mode="after")
    def validate_dates(self):
        if "starts_at" in self.model_fields_set and "ends_at" in self.model_fields_set:
            if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
                raise ValueError("starts_at harus sebelum ends_at")
        return self


class FormResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    type: str
    status: str
    short_code: str
    is_public: bool
    require_login: bool
    theme_color: Optional[str] = None
    banner_path: Optional[str] = None
    thank_you_message: Optional[str] = None
    timer_seconds: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    shuffle_questions: bool
    shuffle_options: bool
    submission_limit: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FormListItem(BaseModel):
    id: int
    title: str
    type: str
    status: str
    short_code: str

    model_config = {"from_attributes": True}


class FormPublishRequest(BaseModel):
    status: str = "published"

    @model_validator(mode="after")
    def validate_status(self):
        if self.status not in ("published", "draft"):
            raise ValueError("status harus 'published' atau 'draft'")
        return self


class FormPublishResponse(BaseModel):
    message: str
    short_code: str


class MessageResponse(BaseModel):
    message: str
    id: int | None = None


class FormListResponse(BaseModel):
    data: list[FormListItem]
    meta: dict
