from datetime import datetime
from enum import Enum
from typing import Annotated
import re

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
# Sama seperti register: ASCII printable tanpa spasi; bcrypt max 72 byte.
_PASSWORD_RE = re.compile(r"^[!-~]+$")


class AdminRole(str, Enum):
    admin = "admin"
    user = "user"


class AdminStatsResponse(BaseModel):
    total_users: int
    total_submissions: int
    total_forms: int
    total_ai_generations: int


class AdminUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class AdminUserDetailResponse(AdminUserResponse):
    total_forms: int
    total_submissions: int


class AdminUserCreate(BaseModel):
    # Dibuat admin → langsung aktif & terverifikasi, tanpa OTP email.
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=150, pattern=_EMAIL_RE)
    password: str = Field(min_length=8, max_length=72)
    role: AdminRole = AdminRole.user

    @field_validator("password")
    @classmethod
    def password_charset(cls, v: str) -> str:
        if not _PASSWORD_RE.fullmatch(v):
            raise ValueError("Password may only contain letters, numbers, and special characters")
        return v


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_charset(cls, v: str | None) -> str | None:
        if v is not None and not _PASSWORD_RE.fullmatch(v):
            raise ValueError("Password may only contain letters, numbers, and special characters")
        return v


class AdminUserListResponse(BaseModel):
    items: list[AdminUserResponse]
    page: int
    limit: int
    total: int
    pages: int


class AdminUserRoleUpdate(BaseModel):
    role: AdminRole


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminUserIdsRequest(BaseModel):
    user_ids: list[Annotated[int, Field(ge=1)]] = Field(min_length=1, max_length=100)


class AdminBulkStatusRequest(AdminUserIdsRequest):
    is_active: bool


class AdminBulkDeleteRequest(AdminUserIdsRequest):
    permanent: bool = False


class AdminPermanentDeleteRequest(BaseModel):
    confirmation: str = Field(min_length=1, max_length=150)


class RegistrationStatusResponse(BaseModel):
    registration_open: bool


class RegistrationStatusUpdate(BaseModel):
    is_open: bool
