from typing import Optional

from pydantic import BaseModel


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
    started_at: Optional[str] = None    # "d-m-Y H:i:s"
    expired_at: Optional[str] = None
    questions: list[QuestionWithOptions]
    # True  = session was already in-progress and is being resumed (e.g. after refresh)
    # False = brand new session was just created
    resumed: bool = False


class AutosaveRequest(BaseModel):
    question_id: int
    option_ids: Optional[list[int]] = None   # mc / checkbox
    answer_text: Optional[str] = None        # short_answer / essay


class SubmitResponse(BaseModel):
    message: str
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None


# Used in GET /submissions/{id} — includes saved answers for in-progress resume
# AND grading details for finished submissions.
class SavedAnswer(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    # What the respondent saved so far (populated regardless of submission status)
    selected_option_ids: list[int] = []
    answer_text: Optional[str] = None
    # Grading — only populated after submission is completed
    selected_options: list[str] = []
    is_correct: Optional[bool] = None
    points_earned: Optional[float] = None


class SubmissionDetailResponse(BaseModel):
    id: int
    status: str
    started_at: Optional[str] = None
    expired_at: Optional[str] = None
    score: Optional[float] = None
    max_score: Optional[float] = None
    submitted_at: Optional[str] = None
    # For in-progress: questions in order (to allow UI rebuild after reload)
    questions: list[QuestionWithOptions] = []
    # For all statuses: saved answers (sparse — only questions answered so far)
    answers: list[SavedAnswer] = []


class SubmissionListItem(BaseModel):
    id: int
    form_title: str
    status: str
    score: Optional[float] = None
    submitted_at: Optional[str] = None


class SubmissionListResponse(BaseModel):
    data: list[SubmissionListItem]
