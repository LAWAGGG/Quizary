from io import BytesIO
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from openpyxl import Workbook

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form
from app.models.submission import Submission, SubmissionStatus
from app.models.answer import Answer
from app.models.question import Question
from app.models.user import User
from app.schemas.results import (
    ResultItem,
    ResultListResponse,
    AnalyticsResponse,
    PerQuestionStat,
    ScoreDistribution,
    DashboardResponse,
    RecentForm,
    SubmissionTrend,
)

router = APIRouter(tags=["results & dashboard"])


@router.get("/forms/{form_id}/results", response_model=ResultListResponse)
def list_results(
    form: Form = Depends(verify_form_owner),
    status_filter: str | None = Query(None, alias="status"),
    sort: str | None = Query(None, alias="sort"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Submission).filter(Submission.form_id == form.id)
    if status_filter:
        q = q.filter(Submission.status == status_filter)

    if sort == "score_desc":
        q = q.order_by(Submission.score.desc())
    elif sort == "score_asc":
        q = q.order_by(Submission.score.asc())
    else:
        q = q.order_by(Submission.created_at.desc())

    total = q.count()
    subs = q.offset((page - 1) * per_page).limit(per_page).all()

    return ResultListResponse(
        data=[ResultItem(
            submission_id=s.id,
            respondent_name=s.respondent_name,
            score=s.score,
            max_score=s.max_score,
            status=s.status.value,
            submitted_at=s.submitted_at,
        ) for s in subs],
        meta={"total": total, "page": page, "per_page": per_page},
    )


@router.get("/forms/{form_id}/analytics", response_model=AnalyticsResponse)
def get_analytics(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
    subs = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
    ).all()

    total = len(subs)
    if total == 0:
        return AnalyticsResponse(
            total_participants=0, average_score=0, highest_score=0, lowest_score=0,
            correct_rate=0, wrong_rate=0, score_distribution=[], per_question_stats=[],
        )

    scores = [s.score or 0 for s in subs]
    avg = sum(scores) / total
    highest = max(scores)
    lowest = min(scores)

    questions = db.query(Question).filter(Question.form_id == form.id).all()
    per_q = []
    total_correct = 0
    total_answers = 0

    for q in questions:
        answers = db.query(Answer).filter(
            Answer.question_id == q.id,
            Answer.submission_id.in_([s.id for s in subs]),
        ).all()
        correct = sum(1 for a in answers if a.is_correct is True)
        wrong = sum(1 for a in answers if a.is_correct is False)
        per_q.append(PerQuestionStat(question_id=q.id, correct_count=correct, wrong_count=wrong))
        total_correct += correct
        total_answers += correct + wrong

    rate = total_correct / total_answers if total_answers else 0

    dist = {}
    for s in scores:
        key = f"{int(s)}-{int(s)}"
        if int(s) <= 1:
            key = "0-1"
        elif int(s) <= 3:
            key = "2-3"
        elif int(s) <= 5:
            key = "4-5"
        else:
            key = "6+"
        dist[key] = dist.get(key, 0) + 1

    return AnalyticsResponse(
        total_participants=total,
        average_score=round(avg, 2),
        highest_score=highest,
        lowest_score=lowest,
        correct_rate=round(rate, 2),
        wrong_rate=round(1 - rate, 2),
        score_distribution=[ScoreDistribution(range=k, count=v) for k, v in sorted(dist.items())],
        per_question_stats=per_q,
    )


@router.get("/forms/{form_id}/export/excel")
def export_excel(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
    subs = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
    ).order_by(Submission.score.desc()).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Hasil"
    ws.append(["Responden", "Skor", "Max Skor", "Status", "Dikirim"])

    for s in subs:
        ws.append([s.respondent_name or "Anonim", s.score, s.max_score, s.status.value, s.submitted_at])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=hasil-{form.short_code}.xlsx"},
    )


@router.get("/dashboard/summary", response_model=DashboardResponse)
def dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    forms = db.query(Form).filter(Form.user_id == user.id).all()
    total_forms = len(forms)
    total_quiz = sum(1 for f in forms if f.type.value == "quiz")
    total_submissions = sum(db.query(Submission).filter(Submission.form_id == f.id).count() for f in forms)
    respondent_ids = set()
    for f in forms:
        for s in db.query(Submission).filter(Submission.form_id == f.id).all():
            if s.user_id:
                respondent_ids.add(s.user_id)
    total_respondents = len(respondent_ids)

    recent = sorted(forms, key=lambda f: f.created_at or datetime(2000, 1, 1, tzinfo=timezone.utc), reverse=True)[:5]
    recent_data = []
    for f in recent:
        cnt = db.query(Submission).filter(Submission.form_id == f.id).count()
        recent_data.append(RecentForm(id=f.id, title=f.title, status=f.status.value, submission_count=cnt))

    return DashboardResponse(
        total_forms=total_forms, total_quiz=total_quiz,
        total_submissions=total_submissions, total_respondents=total_respondents,
        recent_forms=recent_data, submission_trend=[],
    )
