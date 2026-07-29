import random
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user, verify_form_owner
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.form import Form
from app.models.question import Question
from app.models.question_option import QuestionOption
from app.models.submission import Submission, SubmissionStatus
from app.models.submission_question_order import SubmissionQuestionOrder
from app.models.submission_option_order import SubmissionOptionOrder
from app.models.user import User
from app.schemas.submissions import (
    SubmissionCreateRequest,
    SubmissionCreateResponse,
    QuestionWithOptions,
    OptionPublic,
    AutosaveRequestChoice,
    AutosaveRequestText,
    SubmitResponse,
    SubmissionDetailResponse,
    AnswerDetail,
    SubmissionListItem,
    SubmissionListResponse,
    MessageResponse,
)

router = APIRouter(tags=["submissions"])


@router.post("/submissions", status_code=201)
def create_submission(
    body: SubmissionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    form = db.get(Form, body.form_id)
    if not form or form.status.value != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form tidak ditemukan")

    now = datetime.now(timezone.utc)
    if form.ends_at and now > form.ends_at:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Waktu pengisian telah berakhir")

    existing = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status == SubmissionStatus.in_progress,
    )
    if user:
        existing = existing.filter(Submission.user_id == user.id)
    else:
        existing = existing.filter(Submission.ip_address == request.client.host if request.client else "unknown")
    existing_sub = existing.first()
    if existing_sub:
        return MessageResponse(message="Anda memiliki sesi pengerjaan yang belum selesai", submission_id=existing_sub.id)

    sub = Submission(
        form_id=form.id,
        user_id=user.id if user else None,
        respondent_name=body.respondent_name,
        respondent_email=body.respondent_email,
        ip_address=request.client.host if request.client else None,
        status=SubmissionStatus.in_progress,
        started_at=now,
    )
    db.add(sub)
    db.flush()

    questions = db.query(Question).filter(Question.form_id == form.id).order_by(Question.order_index).all()

    if form.shuffle_questions:
        random.shuffle(questions)

    for idx, q in enumerate(questions):
        sqo = SubmissionQuestionOrder(submission_id=sub.id, question_id=q.id, order_index=idx)
        db.add(sqo)

        if form.shuffle_options and q.type.value in ("multiple_choice", "checkbox"):
            opts = list(q.options)
            random.shuffle(opts)
            for oi, opt in enumerate(opts):
                soo = SubmissionOptionOrder(submission_id=sub.id, option_id=opt.id, order_index=oi)
                db.add(soo)

    expired_at = None
    if form.timer_seconds:
        expired_at = now + timedelta(seconds=form.timer_seconds)
        if form.ends_at:
            expired_at = min(expired_at, form.ends_at)

    db.commit()

    ordered_qs = db.query(Question).join(
        SubmissionQuestionOrder,
        SubmissionQuestionOrder.question_id == Question.id,
    ).filter(
        SubmissionQuestionOrder.submission_id == sub.id,
    ).order_by(SubmissionQuestionOrder.order_index).all()

    q_response = []
    for q in ordered_qs:
        if q.type.value in ("multiple_choice", "checkbox"):
            option_orders = {
                soo.option_id: soo.order_index
                for soo in db.query(SubmissionOptionOrder).filter(
                    SubmissionOptionOrder.submission_id == sub.id,
                    SubmissionOptionOrder.option_id.in_([o.id for o in q.options]),
                ).all()
            }
            opts = sorted(q.options, key=lambda o: option_orders.get(o.id, o.order_index or 0))
        else:
            opts = sorted(q.options, key=lambda o: o.order_index or 0)

        q_response.append(QuestionWithOptions(
            id=q.id,
            type=q.type.value,
            question_text=q.question_text,
            order_index=ordered_qs.index(q),
            options=[OptionPublic(id=o.id, option_text=o.option_text, order_index=i) for i, o in enumerate(opts)],
        ))

    return SubmissionCreateResponse(
        submission_id=sub.id,
        started_at=sub.started_at,
        expired_at=expired_at,
        questions=q_response,
    )


def _get_submission_or_404(sub_id: int, db: Session) -> Submission:
    sub = db.get(Submission, sub_id)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission tidak ditemukan")
    return sub


def _check_expired(sub: Submission, form: Form) -> bool:
    if not sub.started_at:
        return False
    now = datetime.now(timezone.utc)
    expired = sub.started_at + timedelta(seconds=form.timer_seconds) if form.timer_seconds else None
    if form.ends_at:
        expired = min(expired, form.ends_at) if expired else form.ends_at
    return expired is not None and now > expired


@router.patch("/submissions/{submission_id}/autosave", response_model=dict)
def autosave(
    submission_id: int,
    body: AutosaveRequestChoice | AutosaveRequestText,
    request: Request,
    db: Session = Depends(get_db),
):
    sub = _get_submission_or_404(submission_id, db)
    form = db.get(Form, sub.form_id)

    if sub.status != SubmissionStatus.in_progress:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission sudah pernah diselesaikan")

    if _check_expired(sub, form):
        sub.status = SubmissionStatus.auto_submitted
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Waktu pengerjaan telah berakhir")

    answer = db.query(Answer).filter(
        Answer.submission_id == sub.id,
        Answer.question_id == body.question_id,
    ).first()

    if not answer:
        answer = Answer(submission_id=sub.id, question_id=body.question_id)
        db.add(answer)
        db.flush()

    if hasattr(body, "option_ids"):
        db.query(AnswerOption).filter(AnswerOption.answer_id == answer.id).delete()
        for oid in body.option_ids:
            db.add(AnswerOption(answer_id=answer.id, option_id=oid))
        answer.answer_text = None
    elif hasattr(body, "answer_text"):
        answer.answer_text = body.answer_text
        db.query(AnswerOption).filter(AnswerOption.answer_id == answer.id).delete()

    db.commit()
    return {"message": "Jawaban tersimpan", "question_id": body.question_id}


@router.post("/submissions/{submission_id}/submit", response_model=SubmitResponse)
def submit_answers(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    sub = _get_submission_or_404(submission_id, db)
    form = db.get(Form, sub.form_id)

    if sub.status != SubmissionStatus.in_progress:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission sudah pernah diselesaikan")

    if _check_expired(sub, form):
        sub.status = SubmissionStatus.auto_submitted
    else:
        sub.status = SubmissionStatus.submitted

    total_score = 0.0
    max_score = 0.0

    questions = db.query(Question).filter(Question.form_id == form.id).all()
    q_map = {q.id: q for q in questions}
    max_score = sum(q.points or 0 for q in questions)

    answers = db.query(Answer).filter(Answer.submission_id == sub.id).all()
    for answer in answers:
        q = q_map.get(answer.question_id)
        if not q:
            continue
        if q.type.value in ("multiple_choice", "checkbox"):
            correct_ids = {o.id for o in q.options if o.is_correct}
            selected_ids = {ao.option_id for ao in answer.selected_options}
            if correct_ids and selected_ids == correct_ids:
                answer.is_correct = True
                answer.points_earned = float(q.points or 0)
                total_score += float(q.points or 0)
            else:
                answer.is_correct = False
                answer.points_earned = 0.0
        elif q.type.value == "short_answer":
            if answer.answer_text and answer.answer_text.strip():
                answer.is_correct = True
                answer.points_earned = float(q.points or 0)
                total_score += float(q.points or 0)
            else:
                answer.is_correct = False
                answer.points_earned = 0.0
        else:
            answer.is_correct = None
            answer.points_earned = 0.0

    sub.score = total_score
    sub.max_score = max_score
    sub.submitted_at = datetime.now(timezone.utc)
    db.commit()

    return SubmitResponse(message="Jawaban berhasil dikirim", status=sub.status.value, score=total_score, max_score=max_score)


@router.get("/submissions/{submission_id}")
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    sub = _get_submission_or_404(submission_id, db)
    form = db.get(Form, sub.form_id)

    is_owner = user and form and form.user_id == user.id

    answers_data = []
    questions = db.query(Question).filter(Question.form_id == form.id).all()
    q_map = {q.id: q for q in questions}

    answers = db.query(Answer).filter(Answer.submission_id == sub.id).all()
    for answer in answers:
        q = q_map.get(answer.question_id)
        if not q:
            continue
        selected_opts = []
        for ao in answer.selected_options:
            opt = db.get(QuestionOption, ao.option_id)
            if opt:
                selected_opts.append(opt.option_text)

        answers_data.append(AnswerDetail(
            question_id=q.id,
            question_text=q.question_text,
            answer_text=answer.answer_text,
            selected_options=selected_opts,
            is_correct=answer.is_correct,
            points_earned=answer.points_earned,
        ))

    return SubmissionDetailResponse(
        id=sub.id,
        status=sub.status.value,
        score=sub.score,
        max_score=sub.max_score,
        submitted_at=sub.submitted_at,
        answers=answers_data,
    )


@router.get("/me/submissions", response_model=SubmissionListResponse)
def my_submissions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subs = db.query(Submission).filter(Submission.user_id == user.id).order_by(Submission.created_at.desc()).all()
    data = []
    for s in subs:
        f = db.get(Form, s.form_id)
        data.append(SubmissionListItem(
            id=s.id,
            form_title=f.title if f else "(deleted)",
            status=s.status.value,
            score=s.score,
            submitted_at=s.submitted_at,
        ))
    return SubmissionListResponse(data=data)
