from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.form import _title_has_text
from app.schemas.question import QuestionCreate


class AiSettings(BaseModel):
    shuffle_questions: bool = False
    shuffle_options: bool = False
    timer_minutes: Optional[int] = Field(None, ge=1, le=1440)
    require_login: bool = False
    submission_limit: str = "unlimited"

    @model_validator(mode="after")
    def validate_enums(self):
        if self.submission_limit not in ("unlimited", "once"):
            raise ValueError("submission_limit harus 'unlimited' atau 'once'")
        return self


class AiSectionAccept(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    questions: list[QuestionCreate] = Field(min_length=1, max_length=50)


class AiAcceptRequest(BaseModel):
    title: str = Field(min_length=1, max_length=1000)
    description: Optional[str] = Field(None, max_length=5000)
    type: str = "form"
    settings: AiSettings = AiSettings()
    sections: list[AiSectionAccept] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_title(self):
        _title_has_text(self.title)
        return self

    @model_validator(mode="after")
    def validate_enums(self):
        if self.type not in ("form", "quiz"):
            raise ValueError("type harus 'form' atau 'quiz'")
        return self


class AiDraftOption(BaseModel):
    option_text: str
    is_correct: bool


class AiDraftQuestion(BaseModel):
    type: str
    question_text: str
    is_required: bool = True
    points: int = 0
    options: list[AiDraftOption] = []
    password_keyword: Optional[str] = None


class AiDraftSection(BaseModel):
    title: str
    questions: list[AiDraftQuestion]


class AiDraftSettings(BaseModel):
    shuffle_questions: bool = False
    shuffle_options: bool = False
    timer_minutes: Optional[int] = None
    require_login: bool = False
    submission_limit: str = "unlimited"


class AiGenerateResponse(BaseModel):
    draft: dict
    model: str = ""
    remaining: int
    limit: int


class AiQuotaResponse(BaseModel):
    limit: int
    used: int
    remaining: int


class AiAcceptResponse(BaseModel):
    id: int
    message: str
