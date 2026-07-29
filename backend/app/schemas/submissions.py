from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SubmissionCreateRequest(BaseModel):
    form_id: int
    respondent_name: Optional[str] = None
    respondent_email: Optional[str] = None


class OptionPublic(BaseModel):
    id: int
    option_text: str
    order_index: int


class QuestionWithOptions(BaseModel):
    id: int
    type: str
    question_text: str
    order_index: int
    options: list[OptionPublic]


class SubmissionCreateResponse(BaseModel):
    submission_id: int
    started_at: datetime
    expired_at: Optional[datetime] = None
    questions: list[QuestionWithOptions]


class AutosaveRequestChoice(BaseModel):
    question_id: int
    option_ids: list[int] = []


class AutosaveRequestText(BaseModel):
    question_id: int
    answer_text: str


class SubmitResponse(BaseModel):
    message: str
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None


class AnswerDetail(BaseModel):
    question_id: int
    question_text: str
    answer_text: Optional[str] = None
    selected_options: list[str] = []
    is_correct: Optional[bool] = None
    points_earned: Optional[float] = None


class SubmissionDetailResponse(BaseModel):
    id: int
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    answers: list[AnswerDetail]


class SubmissionListItem(BaseModel):
    id: int
    form_title: str
    status: str
    score: Optional[float] = None
    submitted_at: Optional[datetime] = None


class SubmissionListResponse(BaseModel):
    data: list[SubmissionListItem]


class MessageResponse(BaseModel):
    message: str
    submission_id: Optional[int] = None
