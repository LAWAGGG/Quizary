from typing import Optional

from pydantic import BaseModel, model_validator


class SubmissionCreateRequest(BaseModel):
    form_id: int
    respondent_name: Optional[str] = None
    respondent_email: Optional[str] = None


class OptionPublic(BaseModel):
    id: int
    option_text: str
    order_index: int
    image: Optional[dict] = None


class QuestionWithOptions(BaseModel):
    id: int
    type: str
    question_text: str
    order_index: int
    is_required: bool = True
    section_id: Optional[int] = None
    image: Optional[dict] = None
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
    option_ids: Optional[list[int]] = None   # mc / checkbox / dropdown
    answer_text: Optional[str] = None        # short_answer / essay / date / time

    @model_validator(mode="after")
    def validate_answer_text(self):
        if self.answer_text is not None and not isinstance(self.answer_text, str):
            raise ValueError("answer_text must be a string")
        return self


class SubmitResponse(BaseModel):
    message: str
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None


class TabExitRequest(BaseModel):
    reason: Optional[str] = None


# Used in GET /submissions/{id} — includes saved answers for in-progress resume
# AND grading details for finished submissions.
class SavedAnswer(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    question_image: Optional[str] = None  # full URL to question image, if any
    # What the respondent saved so far (populated regardless of submission status)
    selected_option_ids: list[int] = []
    answer_text: Optional[str] = None
    answer_file: Optional[str] = None  # full URL to uploaded answer file
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
    respondent_name: Optional[str] = None
    respondent_email: Optional[str] = None
    # For in-progress: questions in order (to allow UI rebuild after reload)
    questions: list[QuestionWithOptions] = []
    # Sections for grouping questions into pages (title map by id)
    sections: list[dict] = []
    # For all statuses: saved answers (sparse — only questions answered so far)
    answers: list[SavedAnswer] = []


class SubmissionListItem(BaseModel):
    id: int
    form_title: str
    status: str
    type: str = "form"
    score: Optional[float] = None
    submitted_at: Optional[str] = None


class SubmissionListResponse(BaseModel):
    data: list[SubmissionListItem]
