import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form, FormStatus, FormType, SubmissionLimit
from app.models.question import Question
from app.models.user import User
from app.utils import file_url
from app.schemas.form import (
    FormCreate,
    FormListItem,
    FormListResponse,
    FormPublishRequest,
    FormPublishResponse,
    FormResponse,
    FormUpdate,
    MessageResponse,
)

router = APIRouter(tags=["forms"])


def _generate_short_code() -> str:
    return secrets.token_urlsafe(4).upper()


def _parse_enum(val: str, enum_cls, field_name: str):
    try:
        return enum_cls(val)
    except ValueError:
        valid = [e.value for e in enum_cls]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} harus salah satu dari: {', '.join(valid)}",
        )


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


@router.post("/forms", status_code=201, response_model=FormResponse)
def create_form(body: FormCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    short_code = _generate_short_code()
    while db.query(Form).filter(Form.short_code == short_code).first():
        short_code = _generate_short_code()

    form = Form(
        user_id=user.id,
        title=body.title,
        description=body.description,
        type=_parse_enum(body.type, FormType, "type"),
        is_public=body.is_public,
        require_login=body.require_login,
        submission_limit=_parse_enum(body.submission_limit, SubmissionLimit, "submission_limit"),
        short_code=short_code,
        created_at=datetime.now(timezone.utc),
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


@router.get("/forms/{form_id}", response_model=FormResponse)
def get_form(request: Request, form: Form = Depends(verify_form_owner)):
    form.banner_path = file_url(request, form.banner_path)
    return form


@router.put("/forms/{form_id}", response_model=MessageResponse, response_model_exclude_none=True)
def update_form(
    body: FormUpdate,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "type" and value:
            value = _parse_enum(value, FormType, "type")
        elif field == "status" and value:
            value = _parse_enum(value, FormStatus, "status")
        elif field == "submission_limit" and value:
            value = _parse_enum(value, SubmissionLimit, "submission_limit")
        setattr(form, field, value)

    form.updated_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Form diperbarui", id=form.id)


@router.delete("/forms/{form_id}", response_model=MessageResponse, response_model_exclude_none=True)
def delete_form(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
    db.delete(form)
    db.commit()
    return MessageResponse(message="Form dan seluruh data terkait telah dihapus")


@router.patch("/forms/{form_id}/publish", response_model=FormPublishResponse)
def publish_form(
    body: FormPublishRequest,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    if body.status == "published":
        question_count = db.query(Question).filter(Question.form_id == form.id).count()
        if question_count == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Form minimal harus memiliki 1 soal sebelum dipublikasikan",
            )

    form.status = _parse_enum(body.status, FormStatus, "status")
    form.updated_at = datetime.now(timezone.utc)
    db.commit()
    return FormPublishResponse(message="Form dipublikasikan", short_code=form.short_code)
