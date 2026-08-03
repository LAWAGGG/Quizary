import random
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.form import Form, FormStatus, SubmissionLimit
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.models.submission import Submission, SubmissionStatus
from app.models.submission_question_order import SubmissionQuestionOrder
from app.models.submission_option_order import SubmissionOptionOrder
from app.models.user import User
from app.services.grading import grade_submission
from app.utils import now_wib, fmt_dt
from app.schemas.submissions import (
    SubmissionCreateRequest,
    SubmissionCreateResponse,
    QuestionWithOptions,
    OptionPublic,
    AutosaveRequest,
    SubmitResponse,
    SubmissionDetailResponse,
    SavedAnswer,
    SubmissionListItem,
    SubmissionListResponse,
)

router = APIRouter(tags=["submissions"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _now():
    return now_wib()


def _get_sub_or_404(sub_id: int, db: Session) -> Submission:
    sub = db.get(Submission, sub_id)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return sub


def _expired_at(sub: Submission, form: Form):
    started = sub.started_at
    if not started:
        return None
    exp = started + timedelta(seconds=form.timer_seconds) if form.timer_seconds else None
    ends = form.ends_at
    if exp and ends:
        return min(exp, ends)
    return exp or ends


def _is_expired(sub: Submission, form: Form) -> bool:
    exp = _expired_at(sub, form)
    return exp is not None and _now() > exp


def _get_question_for_submission(question_id: int, sub: Submission, db: Session) -> Question:
    row = db.query(SubmissionQuestionOrder).filter(
        SubmissionQuestionOrder.submission_id == sub.id,
        SubmissionQuestionOrder.question_id == question_id,
    ).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this submission",
        )
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return q


def _validate_option_ids(option_ids: list[int], question: Question) -> None:
    valid = {o.id for o in question.options}
    for oid in option_ids:
        if oid not in valid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Option {oid} not found in this question",
            )


def _build_questions_response(sub_id: int, db: Session) -> list[QuestionWithOptions]:
    """
    Ordered questions for a submission — respects per-submission shuffle.
    Does NOT expose is_correct (security boundary for respondents).
    """
    ordered_qs = (
        db.query(Question)
        .join(SubmissionQuestionOrder, SubmissionQuestionOrder.question_id == Question.id)
        .filter(SubmissionQuestionOrder.submission_id == sub_id)
        .order_by(SubmissionQuestionOrder.order_index)
        .all()
    )

    result = []
    for idx, q in enumerate(ordered_qs):
        if q.type in (QuestionType.multiple_choice, QuestionType.checkbox):
            opt_order = {
                soo.option_id: soo.order_index
                for soo in db.query(SubmissionOptionOrder).filter(
                    SubmissionOptionOrder.submission_id == sub_id,
                    SubmissionOptionOrder.option_id.in_([o.id for o in q.options]),
                ).all()
            }
            opts = sorted(q.options, key=lambda o: opt_order.get(o.id, o.order_index or 0))
        else:
            opts = []

        result.append(QuestionWithOptions(
            id=q.id,
            type=q.type.value,
            question_text=q.question_text,
            order_index=idx,
            options=[
                OptionPublic(id=o.id, option_text=o.option_text, order_index=i)
                for i, o in enumerate(opts)
            ],
        ))
    return result


# ── POST /submissions ─────────────────────────────────────────────────────────

@router.post("/submissions", status_code=201)
def create_submission(
    body: SubmissionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """
    Start a new submission session and receive all questions ordered for this session.

    If the user/IP already has an in-progress session for this form, the existing
    session is RESUMED instead of creating a duplicate — so refreshing the page or
    navigating away and coming back will always restore the same session with the
    same question order and already-saved answers.
    """
    form = db.get(Form, body.form_id)
    if not form or form.status != FormStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    now = _now()
    ends = form.ends_at
    if ends and now > ends:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Form submission period has ended")

    starts = form.starts_at
    if starts and now < starts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Form is not open yet. Opens at {fmt_dt(starts)}",
        )

    ip = request.client.host if request.client else None

    # ── Resume existing in-progress session ──────────────────────────────────
    # Instead of returning 409, we hand back the existing session so the
    # respondent can continue after a refresh/navigation without losing progress.
    in_progress_q = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status == SubmissionStatus.in_progress,
    )
    if user:
        in_progress_q = in_progress_q.filter(Submission.user_id == user.id)
    elif ip:
        in_progress_q = in_progress_q.filter(Submission.ip_address == ip)

    existing = in_progress_q.first()
    if existing:
        # Edge-case: the existing session may have already expired server-side.
        if _is_expired(existing, form):
            existing.status = SubmissionStatus.auto_submitted
            existing.submitted_at = now
            grade_submission(db, existing, form)
            db.commit()
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Your previous session has expired")

        # Return the existing session with the same question order — idempotent resume.
        return SubmissionCreateResponse(
            submission_id=existing.id,
            started_at=fmt_dt(existing.started_at),
            expired_at=fmt_dt(_expired_at(existing, form)),
            questions=_build_questions_response(existing.id, db),
            resumed=True,
        )

    # ── Check submission_limit=once ───────────────────────────────────────────
    if form.submission_limit == SubmissionLimit.once:
        done_q = db.query(Submission).filter(
            Submission.form_id == form.id,
            Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
        )
        if user:
            done_q = done_q.filter(Submission.user_id == user.id)
        elif ip:
            done_q = done_q.filter(Submission.ip_address == ip)
        if done_q.first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already submitted this form")

    # ── Create new session ────────────────────────────────────────────────────
    sub = Submission(
        form_id=form.id,
        user_id=user.id if user else None,
        respondent_name=body.respondent_name,
        respondent_email=body.respondent_email,
        ip_address=ip,
        status=SubmissionStatus.in_progress,
        started_at=now,
        created_at=now,
    )
    db.add(sub)
    db.flush()

    questions = (
        db.query(Question)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index)
        .all()
    )
    if form.shuffle_questions:
        random.shuffle(questions)

    for idx, q in enumerate(questions):
        db.add(SubmissionQuestionOrder(submission_id=sub.id, question_id=q.id, order_index=idx))
        if form.shuffle_options and q.type in (QuestionType.multiple_choice, QuestionType.checkbox):
            opts = list(q.options)
            random.shuffle(opts)
            for oi, opt in enumerate(opts):
                db.add(SubmissionOptionOrder(submission_id=sub.id, option_id=opt.id, order_index=oi))

    db.commit()
    db.refresh(sub)

    return SubmissionCreateResponse(
        submission_id=sub.id,
        started_at=fmt_dt(sub.started_at),
        expired_at=fmt_dt(_expired_at(sub, form)),
        questions=_build_questions_response(sub.id, db),
        resumed=False,
    )


# ── PATCH /submissions/{id}/autosave ─────────────────────────────────────────

def _verify_submission_access(sub: Submission, request: Request, user: User | None, db: Session) -> None:
    form = db.get(Form, sub.form_id)
    if form and user and form.user_id == user.id:
        return
    if sub.user_id and user and sub.user_id == user.id:
        return
    client_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                 or (request.client.host if request.client else None))
    if sub.ip_address and client_ip and sub.ip_address == client_ip:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.patch("/submissions/{submission_id}/autosave")
def autosave(
    submission_id: int,
    body: AutosaveRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    sub = _get_sub_or_404(submission_id, db)
    _verify_submission_access(sub, request, user, db)
    form = db.get(Form, sub.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if sub.status != SubmissionStatus.in_progress:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission already completed")

    if _is_expired(sub, form):
        sub.status = SubmissionStatus.auto_submitted
        sub.submitted_at = _now()
        grade_submission(db, sub, form)
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Submission time has expired")

    question = _get_question_for_submission(body.question_id, sub, db)
    if body.option_ids:
        _validate_option_ids(body.option_ids, question)

    answer = db.query(Answer).filter(
        Answer.submission_id == sub.id,
        Answer.question_id == body.question_id,
    ).first()
    if not answer:
        answer = Answer(submission_id=sub.id, question_id=body.question_id, created_at=_now())
        db.add(answer)
        db.flush()

    if body.option_ids is not None:
        db.query(AnswerOption).filter(AnswerOption.answer_id == answer.id).delete()
        for oid in body.option_ids:
            db.add(AnswerOption(answer_id=answer.id, option_id=oid))
        answer.answer_text = None
    elif body.answer_text is not None:
        answer.answer_text = body.answer_text
        db.query(AnswerOption).filter(AnswerOption.answer_id == answer.id).delete()

    db.commit()
    return {"message": "Answer saved", "question_id": body.question_id}


# ── POST /submissions/{id}/submit ─────────────────────────────────────────────

@router.post("/submissions/{submission_id}/submit")
def submit_answers(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    sub = _get_sub_or_404(submission_id, db)
    _verify_submission_access(sub, request, user, db)
    form = db.get(Form, sub.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if sub.status != SubmissionStatus.in_progress:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission already completed")

    sub.status = SubmissionStatus.auto_submitted if _is_expired(sub, form) else SubmissionStatus.submitted
    sub.submitted_at = _now()
    total_score, max_score = grade_submission(db, sub, form)
    db.commit()

    return SubmitResponse(
        message="Submission completed successfully",
        status=sub.status.value,
        score=total_score,
        max_score=max_score,
    )


# ── GET /submissions/{id} ─────────────────────────────────────────────────────

@router.get("/submissions/{submission_id}")
def get_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    sub = _get_sub_or_404(submission_id, db)
    form = db.get(Form, sub.form_id)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    is_owner = user and form.user_id == user.id
    is_respondent = sub.user_id and user and sub.user_id == user.id
    is_same_ip = sub.ip_address and user is None and request.client.host == sub.ip_address

    if not is_owner and not is_respondent and not is_same_ip:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Ordered questions (respects per-submission shuffle stored in DB)
    questions = _build_questions_response(sub.id, db)

    # Build a map of option_id → option_text for the whole form (used in answers)
    all_options = db.query(QuestionOption).join(
        Question, Question.id == QuestionOption.question_id
    ).filter(Question.form_id == form.id).all()
    opt_text_map = {o.id: o.option_text for o in all_options}

    q_map = {q.id: q for q in db.query(Question).filter(Question.form_id == form.id).all()}

    answers_data: list[SavedAnswer] = []
    for answer in db.query(Answer).filter(Answer.submission_id == sub.id).all():
        q = q_map.get(answer.question_id)
        if not q:
            continue

        selected_ids = [ao.option_id for ao in answer.selected_options]
        selected_texts = [opt_text_map[oid] for oid in selected_ids if oid in opt_text_map]

        answers_data.append(SavedAnswer(
            question_id=q.id,
            question_text=q.question_text,
            question_type=q.type.value,
            selected_option_ids=selected_ids,
            answer_text=answer.answer_text,
            selected_options=selected_texts,
            is_correct=answer.is_correct,
            points_earned=float(answer.points_earned) if answer.points_earned is not None else None,
        ))

    return SubmissionDetailResponse(
        id=sub.id,
        status=sub.status.value,
        started_at=fmt_dt(sub.started_at),
        expired_at=fmt_dt(_expired_at(sub, form)),
        score=float(sub.score) if sub.score is not None else None,
        max_score=float(sub.max_score) if sub.max_score is not None else None,
        submitted_at=fmt_dt(sub.submitted_at),
        questions=questions,
        answers=answers_data,
    )


# ── GET /me/submissions ───────────────────────────────────────────────────────

@router.get("/me/submissions", response_model=SubmissionListResponse)
def my_submissions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subs = (
        db.query(Submission)
        .join(Form, Submission.form_id == Form.id)
        .filter(Submission.user_id == user.id)
        .order_by(Submission.created_at.desc())
        .all()
    )
    data = [
        SubmissionListItem(
            id=s.id,
            form_title=s.form.title if s.form else "(deleted)",
            status=s.status.value,
            score=float(s.score) if s.score is not None else None,
            submitted_at=fmt_dt(s.submitted_at),
        )
        for s in subs
    ]
    return SubmissionListResponse(data=data)
