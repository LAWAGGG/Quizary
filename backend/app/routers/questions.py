from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.models.user import User
from app.services.points import distribute_quiz_points
from app.utils import file_url, _delete_file
from app.schemas.question import (
    MessageResponse,
    QuestionCreate,
    QuestionUpdate,
    ReorderRequest,
)

router = APIRouter(tags=["questions"])

_OPTION_TYPES = ("multiple_choice", "checkbox")
_TEXT_TYPES = ("short_answer", "essay")


def _get_question_or_404(q_id: int, db: Session) -> Question:
    q = db.get(Question, q_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return q


def _ensure_owner(q: Question, user: User, db: Session) -> Form:
    form = db.get(Form, q.form_id)
    if not form or form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")
    return form


def _image_obj(img, request: Request) -> dict | None:
    """Fix #5 — return single image object (first image only), not an array."""
    if img is None:
        return None
    return {"id": img.id, "path": file_url(request, img.path)}


def _build_question(q: Question, request: Request) -> dict:
    """
    Serialize a Question.
    Fix #5: `image` is a single object (first image) on both question and each option.
    """
    q_img = sorted(q.images, key=lambda i: i.order_index or 0)
    opts = []
    for opt in sorted(q.options, key=lambda o: o.order_index or 0):
        opt_imgs = sorted(opt.images, key=lambda i: i.order_index or 0)
        opts.append({
            "id": opt.id,
            "option_text": opt.option_text,
            "is_correct": opt.is_correct,
            "order_index": opt.order_index,
            "image": _image_obj(opt_imgs[0], request) if opt_imgs else None,
        })
    return {
        "id": q.id,
        "type": q.type.value,
        "question_text": q.question_text,
        "points": q.points,
        "is_scored": q.is_scored,
        "order_index": q.order_index,
        "is_required": q.is_required,
        "options": opts,
        "image": _image_obj(q_img[0], request) if q_img else None,
    }


# ── GET /forms/{form_id}/questions ────────────────────────────────────────────

@router.get("/forms/{form_id}/questions")
def list_questions(
    request: Request,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    questions = (
        db.query(Question)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index)
        .all()
    )
    return {"data": [_build_question(q, request) for q in questions]}


# ── POST /forms/{form_id}/questions ───────────────────────────────────────────

@router.post("/forms/{form_id}/questions", status_code=201)
def create_question(
    request: Request,
    body: QuestionCreate,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    max_order = (
        db.query(Question.order_index)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    question = Question(
        form_id=form.id,
        type=QuestionType(body.type),
        question_text=body.question_text,
        points=0 if form.type.value == "quiz" else body.points,
        is_required=body.is_required,
        order_index=next_order,
        created_at=datetime.utcnow(),
    )
    db.add(question)
    db.flush()

    for i, opt in enumerate(body.options):
        db.add(QuestionOption(
            question_id=question.id,
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=i,
        ))

    distribute_quiz_points(form.id, db)
    db.commit()
    db.refresh(question)
    return _build_question(question, request)


# ── PUT /questions/{question_id} ──────────────────────────────────────────────

@router.put("/questions/{question_id}")
def update_question(
    request: Request,
    body: QuestionUpdate,
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)

    update_data = body.model_dump(exclude_unset=True)
    options_data = update_data.pop("options", None)

    # Determine the effective type after this update
    new_type_str = update_data.get("type") or question.type.value

    # Fix #4 — non-empty options with a text type is invalid; an empty list is
    # allowed and simply means "clear options" (e.g. switching MC → short_answer).
    if options_data:
        if new_type_str in _TEXT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question type '{new_type_str}' cannot have options",
            )

    # Fix #4 — if switching to a text type, options must be explicitly cleared in DB
    if "type" in update_data:
        new_type = QuestionType(update_data.pop("type"))
        # Switching FROM option type TO text type → delete all existing options
        if new_type.value in _TEXT_TYPES and question.type.value in _OPTION_TYPES:
            for opt in list(question.options):
                db.delete(opt)
            db.flush()
        # Switching FROM text type TO option type but no options provided → error
        if new_type.value in _OPTION_TYPES and question.type.value in _TEXT_TYPES and not options_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Switching to '{new_type.value}' requires at least 1 option in this request",
            )
        question.type = new_type

    # Toggle is_scored: off → force 0 points; on (no explicit points) → rejoin pool
    was_scored = question.is_scored
    if "is_scored" in update_data:
        if update_data["is_scored"] is False:
            update_data["points"] = 0
        elif "points" not in update_data:
            update_data["points"] = 0

    for field, value in update_data.items():
        setattr(question, field, value)

    question.updated_at = datetime.utcnow()

    # Handle options update (only for option-type questions)
    if options_data is not None:
        existing_ids = {o.id for o in question.options}
        seen_ids: set[int] = set()
        new_opts = []

        for opt_dict in options_data:
            opt_id = opt_dict.get("id")
            if opt_id:
                if opt_id in existing_ids:
                    seen_ids.add(opt_id)
                    opt = db.get(QuestionOption, opt_id)
                    if opt_dict.get("option_text") is not None:
                        opt.option_text = opt_dict["option_text"]
                    if opt_dict.get("is_correct") is not None:
                        opt.is_correct = opt_dict["is_correct"]
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Option {opt_id} not found in this question",
                    )
            else:
                new_opts.append(opt_dict)

        for opt in list(question.options):
            if opt.id not in seen_ids:
                db.delete(opt)

        db.flush()
        remaining = db.query(QuestionOption).filter(QuestionOption.question_id == question.id).count()
        for i, opt_dict in enumerate(new_opts):
            db.add(QuestionOption(
                question_id=question.id,
                option_text=opt_dict.get("option_text", ""),
                is_correct=opt_dict.get("is_correct", False),
                order_index=remaining + i,
            ))

        # Fix #3 carry-over — re-validate mc has exactly 1 correct after update
        db.flush()
        if new_type_str == "multiple_choice":
            correct_count = db.query(QuestionOption).filter(
                QuestionOption.question_id == question.id,
                QuestionOption.is_correct == True,  # noqa: E712
            ).count()
            if correct_count != 1:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="multiple_choice questions must have exactly 1 correct option",
                )

    if question.is_scored and not was_scored:
        distribute_quiz_points(question.form_id, db)
    elif question.is_scored:
        distribute_quiz_points(question.form_id, db, fixed_ids={question.id})
    else:
        distribute_quiz_points(question.form_id, db)
    db.commit()
    db.refresh(question)
    return _build_question(question, request)


# ── DELETE /questions/{question_id} ───────────────────────────────────────────

@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)
    for img in question.images:
        _delete_file(img.path)
    for opt in question.options:
        for img in opt.images:
            _delete_file(img.path)
    form_id = question.form_id
    db.delete(question)
    distribute_quiz_points(form_id, db)
    db.commit()
    return {"message": "Question deleted"}


# ── PATCH /questions/reorder ──────────────────────────────────────────────────

@router.patch("/questions/reorder")
def reorder_questions(
    body: ReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    form = db.get(Form, body.form_id)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")

    for idx, q_id in enumerate(body.orders):
        q = db.get(Question, q_id)
        if not q or q.form_id != body.form_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question {q_id} not found in this form",
            )
        q.order_index = idx

    db.commit()
    return {"message": "Question order updated"}
