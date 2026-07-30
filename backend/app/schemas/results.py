from typing import Optional

from pydantic import BaseModel


class ResultItem(BaseModel):
    submission_id: int
    respondent_name: Optional[str] = None
    score: Optional[float] = None
    max_score: Optional[float] = None
    status: str
    submitted_at: Optional[str] = None   # "d-m-Y H:i:s"


class ResultListResponse(BaseModel):
    data: list[ResultItem]
    meta: dict


class PerQuestionStat(BaseModel):
    question_id: int
    correct_count: int
    wrong_count: int


class ScoreDistribution(BaseModel):
    range: str
    count: int


class AnalyticsResponse(BaseModel):
    total_participants: int
    average_score: float
    highest_score: float
    lowest_score: float
    correct_rate: float
    wrong_rate: float
    score_distribution: list[ScoreDistribution]
    per_question_stats: list[PerQuestionStat]


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



