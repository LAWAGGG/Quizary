from collections import Counter
from io import BytesIO
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from openpyxl import Workbook

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form
from app.models.submission import Submission, SubmissionStatus
from app.models.answer import Answer
from app.models.question import Question
from app.models.user import User
from app.utils import to_naive_utc, fmt_dt
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
            score=float(s.score) if s.score is not None else None,
            max_score=float(s.max_score) if s.max_score is not None else None,
            status=s.status.value,
            submitted_at=fmt_dt(to_naive_utc(s.submitted_at)),
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

    scores = [float(s.score or 0) for s in subs]
    avg = sum(scores) / total

    sub_ids = [s.id for s in subs]
    questions = db.query(Question).filter(Question.form_id == form.id).all()
    all_answers = db.query(Answer).filter(
        Answer.question_id.in_([q.id for q in questions]),
        Answer.submission_id.in_(sub_ids),
    ).all()

    answer_by_q: dict[int, list[Answer]] = {}
    for a in all_answers:
        answer_by_q.setdefault(a.question_id, []).append(a)

    per_q = []
    total_correct = total_answers = 0
    for q in questions:
        answers = answer_by_q.get(q.id, [])
        correct = sum(1 for a in answers if a.is_correct is True)
        wrong = sum(1 for a in answers if a.is_correct is False)
        per_q.append(PerQuestionStat(question_id=q.id, correct_count=correct, wrong_count=wrong))
        total_correct += correct
        total_answers += correct + wrong

    rate = total_correct / total_answers if total_answers else 0

    dist: dict[str, int] = {}
    for s in scores:
        if s <= 1:
            key = "0-1"
        elif s <= 3:
            key = "2-3"
        elif s <= 5:
            key = "4-5"
        else:
            key = "6+"
        dist[key] = dist.get(key, 0) + 1

    return AnalyticsResponse(
        total_participants=total,
        average_score=round(avg, 2),
        highest_score=max(scores),
        lowest_score=min(scores),
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
    ws.append(["Responden", "Email", "Skor", "Max Skor", "Status", "Dikirim"])

    for s in subs:
        ws.append([
            s.respondent_name or "Anonim",
            s.respondent_email or "-",
            float(s.score) if s.score is not None else 0,
            float(s.max_score) if s.max_score is not None else 0,
            s.status.value,
            fmt_dt(to_naive_utc(s.submitted_at)) or "-",
        ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=hasil-{form.short_code}.xlsx"},
    )


@router.get("/forms/{form_id}/export/pdf")
def export_pdf(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="PDF export requires reportlab. Install it with: pip install reportlab",
        )

    subs = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
    ).order_by(Submission.score.desc()).all()

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"Hasil: {form.title}", styles["Title"])]

    data = [["Responden", "Email", "Skor", "Max", "Status", "Dikirim"]]
    for s in subs:
        data.append([
            s.respondent_name or "Anonim",
            s.respondent_email or "-",
            str(float(s.score or 0)),
            str(float(s.max_score or 0)),
            s.status.value,
            fmt_dt(to_naive_utc(s.submitted_at)) or "-",
        ])

    table = Table(data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6C5CE7")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0EFFF")]),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)

    return Response(
        content=buf.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=hasil-{form.short_code}.pdf"},
    )


@router.get("/dashboard/summary", response_model=DashboardResponse)
def dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    forms = db.query(Form).filter(Form.user_id == user.id).all()
    form_ids = [f.id for f in forms]

    subs = db.query(Submission).filter(Submission.form_id.in_(form_ids)).all() if form_ids else []

    # Count unique respondents by user_id or ip_address
    respondent_keys: set = set()
    for s in subs:
        respondent_keys.add(f"u:{s.user_id}" if s.user_id else f"ip:{s.ip_address}")

    recent = sorted(forms, key=lambda f: f.created_at or datetime(2000, 1, 1), reverse=True)[:5]
    sub_count_by_form = Counter(s.form_id for s in subs)
    recent_data = [
        RecentForm(id=f.id, title=f.title, status=f.status.value, submission_count=sub_count_by_form.get(f.id, 0))
        for f in recent
    ]

    date_counts = Counter(s.created_at.date() for s in subs if s.created_at)
    trend = [SubmissionTrend(date=str(d), count=c) for d, c in sorted(date_counts.items())[-7:]]

    return DashboardResponse(
        total_forms=len(forms),
        total_quiz=sum(1 for f in forms if f.type.value == "quiz"),
        total_submissions=len(subs),
        total_respondents=len(respondent_keys),
        recent_forms=recent_data,
        submission_trend=trend,
    )
