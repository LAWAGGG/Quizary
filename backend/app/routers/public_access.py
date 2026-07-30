from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_user
from app.utils import file_url, to_naive_utc, fmt_dt
from app.models.form import Form, FormStatus, SubmissionLimit
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from datetime import datetime

router = APIRouter(tags=["public"])


def _get_published_form(short_code: str, db: Session) -> Form:
    form = db.query(Form).filter(Form.short_code == short_code.upper()).first()
    if not form or form.status != FormStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


@router.get("/q/{short_code}")
def get_public_form(request: Request, short_code: str, db: Session = Depends(get_db)):
    form = _get_published_form(short_code, db)
    return {
        "id": form.id,
        "title": form.title,
        "description": form.description,
        "type": form.type.value,
        "banner_path": file_url(request, form.banner_path),
        "theme_color": form.theme_color,
        "require_login": form.require_login,
        "status": form.status.value,
        "starts_at": fmt_dt(form.starts_at),
        "ends_at": fmt_dt(form.ends_at),
        "timer_seconds": form.timer_seconds,
        "thank_you_message": form.thank_you_message,
    }


@router.get("/q/{short_code}/start")
def start_form_check(
    short_code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    form = _get_published_form(short_code, db)

    if form.require_login and not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login required to access this form",
        )

    # Fix #6 — use to_naive_utc() so comparison is always naive↔naive regardless
    # of how MySQL/SQLAlchemy returns the stored DATETIME value.
    now = datetime.utcnow()
    starts = to_naive_utc(form.starts_at)
    ends = to_naive_utc(form.ends_at)

    if starts and now < starts:
        return {
            "can_start": False,
            "reason": "not_started",
            "starts_at": fmt_dt(starts),
        }

    if ends and now > ends:
        return {"can_start": False, "reason": "closed"}

    if form.submission_limit == SubmissionLimit.once:
        q = db.query(Submission).filter(
            Submission.form_id == form.id,
            Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
        )
        if user:
            q = q.filter(Submission.user_id == user.id)
        else:
            ip = request.client.host if request.client else None
            if ip:
                q = q.filter(Submission.ip_address == ip)
        if q.first():
            return {"can_start": False, "reason": "already_submitted"}

    return {"can_start": True, "form_id": form.id, "require_identity": bool(form.require_login)}
