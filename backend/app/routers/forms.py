import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form, FormStatus, FormType, SubmissionLimit
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.models.image import Image
from app.models.user import User
from app.services.points import distribute_quiz_points
from app.utils import file_url, fmt_dt, to_naive_utc, _delete_file
from app.schemas.form import (
    FormCreate,
    FormListItem,
    FormListResponse,
    FormPublishRequest,
    FormPublishResponse,
    FormUpdate,
    MessageResponse,
)

router = APIRouter(tags=["forms"])


def _generate_short_code(db: Session) -> str:
    while True:
        code = secrets.token_urlsafe(4).upper()
        if not db.query(Form).filter(Form.short_code == code).first():
            return code


def _parse_enum(val: str, enum_cls, field_name: str):
    try:
        return enum_cls(val)
    except ValueError:
        valid = [e.value for e in enum_cls]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must be one of: {', '.join(valid)}",
        )


def _ensure_publishable(form: Form, db: Session) -> None:
    """A form can only be published if it has at least 1 question."""
    if db.query(Question).filter(Question.form_id == form.id).count() == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Form must have at least 1 question before publishing",
        )


def _form_dict(form: Form, request: Request) -> dict:
    """Serialize a Form ORM object to a dict with datetime strings and full banner URL."""
    return {
        "id": form.id,
        "title": form.title,
        "description": form.description,
        "type": form.type.value,
        "status": form.status.value,
        "short_code": form.short_code,
        "is_public": form.is_public,
        "require_login": form.require_login,
        "theme_color": form.theme_color,
        "banner_path": file_url(request, form.banner_path),
        "thank_you_message": form.thank_you_message,
        "timer_seconds": form.timer_seconds,
        "starts_at": fmt_dt(form.starts_at),
        "ends_at": fmt_dt(form.ends_at),
        "shuffle_questions": form.shuffle_questions,
        "shuffle_options": form.shuffle_options,
        "submission_limit": form.submission_limit.value,
        "created_at": fmt_dt(form.created_at),
        "updated_at": fmt_dt(form.updated_at),
    }


# ── GET /forms ────────────────────────────────────────────────────────────────

@router.get("/forms", response_model=FormListResponse)
def list_forms(
    status_filter: str | None = Query(None, alias="status"),
    type_filter: str | None = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Form).filter(Form.user_id == user.id)
    if status_filter:
        q = q.filter(Form.status == status_filter)
    if type_filter:
        q = q.filter(Form.type == type_filter)

    total = q.count()
    forms = q.order_by(Form.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return FormListResponse(
        data=[FormListItem.model_validate(f) for f in forms],
        meta={"total": total, "page": page, "per_page": per_page},
    )


# ── POST /forms ───────────────────────────────────────────────────────────────

@router.post("/forms", status_code=201)
def create_form(
    request: Request,
    body: FormCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    form = Form(
        user_id=user.id,
        title=body.title,
        description=body.description,
        type=_parse_enum(body.type, FormType, "type"),
        is_public=body.is_public,
        require_login=body.require_login,
        submission_limit=_parse_enum(body.submission_limit, SubmissionLimit, "submission_limit"),
        short_code=_generate_short_code(db),
        created_at=now,
        updated_at=now,
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return _form_dict(form, request)


# ── GET /forms/{form_id} ──────────────────────────────────────────────────────

@router.get("/forms/{form_id}")
def get_form(request: Request, form: Form = Depends(verify_form_owner)):
    return _form_dict(form, request)


# ── PUT /forms/{form_id} ──────────────────────────────────────────────────────

@router.put("/forms/{form_id}")
def update_form(
    request: Request,
    body: FormUpdate,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    will_publish = (
        update_data.get("status") == "published"
        and form.status.value != "published"
    )

    if "type" in update_data:
        new_type = _parse_enum(update_data["type"], FormType, "type")
        if new_type != form.type:
            form.type = new_type  # set first so helpers/distribute see the new type
            if new_type == FormType.quiz:
                _prepare_quiz_after_form_conversion(form.id, db)
            else:
                _clear_correct_after_quiz_conversion(form.id, db)

    for field, value in update_data.items():
        if field == "type":
            value = _parse_enum(value, FormType, "type")
        elif field == "status":
            value = _parse_enum(value, FormStatus, "status")
        elif field == "submission_limit":
            value = _parse_enum(value, SubmissionLimit, "submission_limit")
        setattr(form, field, value)

    if will_publish:
        _ensure_publishable(form, db)

    form.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(form)
    return _form_dict(form, request)


def _prepare_quiz_after_form_conversion(form_id: int, db: Session) -> None:
    """form → quiz: mark the first option of each choice question as correct,
    reset all points, then auto-distribute quiz points across questions."""
    questions = (
        db.query(Question)
        .filter(Question.form_id == form_id)
        .order_by(Question.order_index)
        .all()
    )
    for q in questions:
        if q.type in (QuestionType.multiple_choice, QuestionType.checkbox):
            opts = sorted(q.options, key=lambda o: o.order_index or 0)
            if opts and not any(o.is_correct for o in opts):
                opts[0].is_correct = True
        q.points = 0
    distribute_quiz_points(form_id, db)


def _clear_correct_after_quiz_conversion(form_id: int, db: Session) -> None:
    """quiz → form: no correct answers are needed anymore."""
    db.query(QuestionOption).filter(
        QuestionOption.question_id.in_(
            db.query(Question.id).filter(Question.form_id == form_id)
        )
    ).update({"is_correct": False}, synchronize_session=False)


# ── DELETE /forms/{form_id} ───────────────────────────────────────────────────

@router.delete("/forms/{form_id}")
def delete_form(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
    _delete_file(form.banner_path)
    questions = db.query(Question).filter(Question.form_id == form.id).all()
    for q in questions:
        for img in db.query(Image).filter(Image.question_id == q.id).all():
            _delete_file(img.path)
        for opt in db.query(QuestionOption).filter(QuestionOption.question_id == q.id).all():
            for img in db.query(Image).filter(Image.option_id == opt.id).all():
                _delete_file(img.path)
    db.delete(form)
    db.commit()
    return {"message": "Form and all related data have been deleted"}


# ── PATCH /forms/{form_id}/publish ────────────────────────────────────────────

@router.patch("/forms/{form_id}/publish")
def publish_form(
    body: FormPublishRequest,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    if body.status == "published":
        _ensure_publishable(form, db)

    form.status = _parse_enum(body.status, FormStatus, "status")
    form.updated_at = datetime.utcnow()
    db.commit()
    return FormPublishResponse(message="Form published", short_code=form.short_code)
