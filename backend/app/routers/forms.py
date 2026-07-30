import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form, FormStatus, FormType, SubmissionLimit
from app.models.question import Question
from app.models.user import User
from app.utils import file_url, fmt_dt, to_naive_utc
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
    for field, value in update_data.items():
        if field == "type":
            value = _parse_enum(value, FormType, "type")
        elif field == "status":
            value = _parse_enum(value, FormStatus, "status")
        elif field == "submission_limit":
            value = _parse_enum(value, SubmissionLimit, "submission_limit")
        setattr(form, field, value)

    form.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(form)
    return {"message": "Form updated", "id": form.id}


# ── DELETE /forms/{form_id} ───────────────────────────────────────────────────

@router.delete("/forms/{form_id}")
def delete_form(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
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
        if db.query(Question).filter(Question.form_id == form.id).count() == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Form must have at least 1 question before publishing",
            )

    form.status = _parse_enum(body.status, FormStatus, "status")
    form.updated_at = datetime.utcnow()
    db.commit()
    return FormPublishResponse(message="Form published", short_code=form.short_code)
