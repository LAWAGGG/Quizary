from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_user
from app.utils import file_url
from app.models.form import Form, FormStatus
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User

router = APIRouter(tags=["public"])


@router.get("/q/{short_code}")
def get_public_form(request: Request, short_code: str, db: Session = Depends(get_db)):
    form = db.query(Form).filter(Form.short_code == short_code).first()
    if not form or form.status != FormStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form tidak ditemukan")
    return {
        "title": form.title,
        "description": form.description,
        "type": form.type.value,
        "banner_path": file_url(request, form.banner_path),
        "theme_color": form.theme_color,
        "require_login": form.require_login,
        "status": form.status.value,
    }


@router.get("/q/{short_code}/start")
def start_form_check(
    short_code: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    form = db.query(Form).filter(Form.short_code == short_code).first()
    if not form or form.status != FormStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form tidak ditemukan")

    if form.require_login and not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login diperlukan")

    now = datetime.now(timezone.utc)

    if form.starts_at and now < form.starts_at:
        return {"can_start": False, "reason": "not_started", "starts_at": form.starts_at.isoformat()}

    if form.ends_at and now > form.ends_at:
        return {"can_start": False, "reason": "closed"}

    if form.submission_limit.value == "once":
        existing = db.query(Submission).filter(
            Submission.form_id == form.id,
            Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
        )
        if user:
            existing = existing.filter(Submission.user_id == user.id)
        else:
            existing = existing.filter(Submission.ip_address == "unknown")
        if existing.first():
            return {"can_start": False, "reason": "already_submitted"}

    return {"can_start": True, "form_id": form.id, "require_identity": bool(form.require_login)}
