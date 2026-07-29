from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.models.user import User
from app.schemas.question import (
    MessageResponse,
    QuestionCreate,
    QuestionListResponse,
    QuestionResponse,
    QuestionUpdate,
    ReorderRequest,
)

router = APIRouter(tags=["questions"])


def _get_question_or_404(q_id: int, db: Session) -> Question:
    q = db.get(Question, q_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soal tidak ditemukan")
    return q


def _ensure_owner(q: Question, user: User, db: Session) -> None:
    form = db.get(Form, q.form_id)
    if not form or form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik form ini")


@router.get("/forms/{form_id}/questions", response_model=QuestionListResponse)
def list_questions(
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    questions = (
        db.query(Question)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index)
        .all()
    )
    return QuestionListResponse(data=[QuestionResponse.model_validate(q) for q in questions])


@router.post("/forms/{form_id}/questions", status_code=201, response_model=QuestionResponse)
def create_question(
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
        points=body.points,
        is_required=body.is_required,
        order_index=next_order,
        created_at=datetime.now(timezone.utc),
    )
    db.add(question)
    db.flush()

    for i, opt in enumerate(body.options):
        option = QuestionOption(
            question_id=question.id,
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=i,
        )
        db.add(option)

    db.commit()
    db.refresh(question)
    return question


@router.put("/questions/{question_id}", response_model=MessageResponse, response_model_exclude_none=True)
def update_question(
    body: QuestionUpdate,
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)

    update_data = body.model_dump(exclude_unset=True)
    options_data = update_data.pop("options", None)

    for field, value in update_data.items():
        if field == "type" and value:
            value = QuestionType(value)
        setattr(question, field, value)

    question.updated_at = datetime.now(timezone.utc)

    if options_data is not None:
        existing_ids = {o.id for o in question.options}
        seen_ids = set()
        new_option_dicts = []

        for opt_dict in options_data:
            opt_id = opt_dict.get("id")
            if opt_id and opt_id in existing_ids:
                seen_ids.add(opt_id)
                opt = db.get(QuestionOption, opt_id)
                if opt:
                    for k, v in opt_dict.items():
                        if k != "id" and v is not None:
                            setattr(opt, k, v)
            elif not opt_id:
                new_option_dicts.append(opt_dict)

        for opt in question.options:
            if opt.id not in seen_ids:
                db.delete(opt)

        existing_count = db.query(QuestionOption).filter(
            QuestionOption.question_id == question.id
        ).count()
        for i, opt_dict in enumerate(new_option_dicts):
            option = QuestionOption(
                question_id=question.id,
                option_text=opt_dict.get("option_text", ""),
                is_correct=opt_dict.get("is_correct", False),
                order_index=existing_count + i,
            )
            db.add(option)

    db.commit()
    return MessageResponse(message="Soal diperbarui", id=question.id)


@router.delete("/questions/{question_id}", response_model=MessageResponse, response_model_exclude_none=True)
def delete_question(
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)

    db.delete(question)
    db.commit()
    return MessageResponse(message="Soal dihapus")


@router.patch("/questions/reorder", response_model=MessageResponse, response_model_exclude_none=True)
def reorder_questions(
    body: ReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    form = db.get(Form, body.form_id)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form tidak ditemukan")
    if form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik form ini")

    for item in body.orders:
        db.query(Question).filter(Question.id == item.id, Question.form_id == body.form_id).update(
            {"order_index": item.order_index}
        )

    db.commit()
    return MessageResponse(message="Urutan soal diperbarui")
