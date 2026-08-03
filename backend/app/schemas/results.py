from typing import Optional

from pydantic import BaseModel


class ResultItem(BaseModel):
    submission_id: int
    respondent_name: Optional[str] = None
    score: Optional[float] = None
    max_score: Optional[float] = None
    status: str
    submitted_at: Optional[str] = None   # "d-m-Y H:i:s"
    answer_summary: str = ""             # preview jawaban (dipakai untuk form type)


class ResultListResponse(BaseModel):
    data: list[ResultItem]
    meta: dict


class PerQuestionStat(BaseModel):
    question_id: int
    question_text: str = ""
    correct_count: int
    wrong_count: int


class ScoreDistribution(BaseModel):
    range: str
    count: int


class OptionChoice(BaseModel):
    option_id: int
    option_text: str
    count: int
    pct: float


class QuestionStat(BaseModel):
    question_id: int
    question_text: str
    type: str
    answered: int
    skipped: int
    most_selected: Optional[str] = None
    most_selected_count: int = 0
    most_selected_pct: float = 0
    option_breakdown: list[OptionChoice] = []
    sample_answers: list[str] = []


class AnalyticsResponse(BaseModel):
    type: str = "quiz"  # "quiz" | "form"
    total_participants: int
    # quiz-specific
    average_score: float = 0
    highest_score: float = 0
    lowest_score: float = 0
    correct_rate: float = 0
    wrong_rate: float = 0
    score_distribution: list[ScoreDistribution] = []
    per_question_stats: list[PerQuestionStat] = []
    # form-specific
    total_answers: int = 0
    completion_rate: float = 0
    avg_answers: float = 0
    question_stats: list[QuestionStat] = []


class RecentForm(BaseModel):
    id: int
    title: str
    status: str
    submission_count: int


class SubmissionTrend(BaseModel):
    date: str
    count: int


class DashboardResponse(BaseModel):
    total_forms: int
    total_quiz: int
    total_submissions: int
    total_respondents: int
    recent_forms: list[RecentForm]
    submission_trend: list[SubmissionTrend]



