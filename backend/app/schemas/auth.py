from typing import Optional

from pydantic import BaseModel, Field, model_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=150, pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    # bcrypt hanya memproses 72 byte pertama — batasi di sini supaya tidak 500.
    password: str = Field(min_length=8, max_length=72)
    password_confirmation: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.password_confirmation:
            raise ValueError("password_confirmation does not match password")
        return self


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=150, pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    # avatar is always a full URL (resolved by the router before returning)
    avatar: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


class PasswordUpdateRequest(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)
    new_password_confirmation: str

    @model_validator(mode="after")
    def passwords_match_and_different(self):
        if self.new_password != self.new_password_confirmation:
            raise ValueError("new_password_confirmation does not match new_password")
        if self.old_password == self.new_password:
            raise ValueError("New password must be different from old password")
        return self
