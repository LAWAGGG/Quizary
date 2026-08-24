import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_user
from app.utils import file_url, now_wib, fmt_dt
from app.models.form import Form, FormStatus, SubmissionLimit
from app.models.question import Question
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from app.services.session_expiry import auto_submit_expired_for_form

router = APIRouter(tags=["public"])


def _get_form_by_code(short_code: str, db: Session) -> Form:
    form = db.query(Form).filter(Form.short_code == short_code.upper()).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


def _get_published_form(short_code: str, db: Session) -> Form:
    """Strict lookup used by leaderboard — only exposed for published forms."""
    form = _get_form_by_code(short_code, db)
    if form.status != FormStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


@router.get("/q/{short_code}")
def get_public_form(
    request: Request,
    short_code: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    # Public preview: even draft/closed forms are returned so the landing page
    # can explain the state instead of showing a confusing 404. The creator
    # (is_owner) gets a preview notice; everyone else sees status-based messaging.
    form = _get_form_by_code(short_code, db)
    is_owner = bool(user and form.user_id == user.id)
    question_count = db.query(Question).filter(Question.form_id == form.id).count()
    return {
        "id": form.id,
        "title": form.title,
        "description": form.description,
        "type": form.type.value,
        "display_style": form.display_style.value if form.display_style else "card",
        "banner_path": file_url(request, form.banner_path),
        "theme_color": form.theme_color,
        "require_login": form.require_login,
        "status": form.status.value,
        "starts_at": fmt_dt(form.starts_at),
        "ends_at": fmt_dt(form.ends_at),
        "timer_seconds": form.timer_seconds,
        "question_count": question_count,
        "submission_limit": form.submission_limit.value,
        "show_leaderboard": form.show_leaderboard,
        "is_restricted": form.is_restricted,
        "reveal_score": form.reveal_score,
        "reveal_answers": form.reveal_answers,
        "thank_you_message": form.thank_you_message,
        "is_owner": is_owner,
    }


@router.get("/q/{short_code}/start")
def start_form_check(
    short_code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    form = _get_form_by_code(short_code, db)
    is_owner = bool(user and form.user_id == user.id)

    # Sweep sesi kedaluwarsa — submission yang ditinggal lama di-auto-submit.
    auto_submit_expired_for_form(db, form)

    now = now_wib()
    starts = form.starts_at
    ends = form.ends_at

    # Draft / closed: creator may preview; everyone else gets a clear reason.
    # Checked BEFORE require_login so a closed/draft form never asks a stranger
    # to log in — the status message is what matters.
    if form.status == FormStatus.draft:
        if is_owner:
            return {"can_start": True, "form_id": form.id, "require_identity": False, "is_preview": True}
        return {"can_start": False, "reason": "draft"}

    if form.status == FormStatus.closed:
        if is_owner:
            return {"can_start": True, "form_id": form.id, "require_identity": False, "is_preview": True}
        return {"can_start": False, "reason": "closed"}

    if form.require_login and not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login required to access this form",
        )

    # Jadwal (starts_at/ends_at) berlaku untuk SEMUA user, termasuk pemilik.
    # Form published hanya bisa diisi dalam rentang waktu tersebut — pemilik
    # tidak dapat preview lebih awal (preview khusus status draft/closed di atas).
    if starts and now < starts:
        return {"can_start": False, "reason": "not_started"}

    if ends and now > ends:
        return {"can_start": False, "reason": "closed"}

    if form.submission_limit == SubmissionLimit.once:
        ip = request.client.host if request.client else None
        q = db.query(Submission).filter(
            Submission.form_id == form.id,
            Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted, SubmissionStatus.cheating]),
        )
        if user:
            # Identitas respondent = akun, bukan IP. Submission anonim dari IP yang
            # sama tidak diatribusikan ke user login (lihat POST /submissions).
            q = q.filter(Submission.user_id == user.id)
        elif ip:
            q = q.filter(Submission.ip_address == ip)
        if q.first():
            return {"can_start": False, "reason": "already_submitted"}

    # require_identity hanya relevan kalau user belum teridentifikasi. Untuk
    # form require_login, user yang belum login sudah ditolak 401 di atas, dan
    # identitas user yang login otomatis diambil dari akun — jadi tidak perlu
    # meminta nama/email tambahan.
    return {"can_start": True, "form_id": form.id, "require_identity": bool(form.require_login and not user)}


@router.get("/q/{short_code}/leaderboard")
def get_leaderboard(
    short_code: str,
    request: Request,
    limit: int = Query(10, ge=1, le=50),
    submission_id: int | None = Query(None),
    x_submission_token: str | None = Header(None, alias="X-Submission-Token"),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Public, read-only Top-N leaderboard for quiz forms (FR-38).

    Only exposed when the creator enabled `show_leaderboard`. Cheating
    submissions are excluded (score 0, visible only to the creator).
    Optional `submission_id` returns the caller's own rank/entry too —
    only when the caller proves ownership of that submission (token/user/
    IP legacy), otherwise it is silently omitted.
    """
    form = _get_published_form(short_code, db)
    if not form.show_leaderboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leaderboard not available")

    base = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.auto_submitted]),
    )
    total = base.count()

    ranked = (
        base.order_by(Submission.score.desc(), Submission.submitted_at.asc(), Submission.id.asc())
        .all()
    )

    def entry(sub: Submission, rank: int) -> dict:
        return {
            "rank": rank,
            "respondent_name": sub.respondent_name or "Anonymous",
            "score": float(sub.score) if sub.score is not None else 0.0,
        }

    data = [entry(s, i + 1) for i, s in enumerate(ranked[:limit])]

    own = None
    if submission_id:
        sub = db.get(Submission, submission_id)
        if (
            sub
            and sub.form_id == form.id
            and sub.status in (SubmissionStatus.submitted, SubmissionStatus.auto_submitted)
            and _owns_submission(db, form, sub, request, user, x_submission_token)
        ):
            rank = next((i + 1 for i, s in enumerate(ranked) if s.id == sub.id), None)
            own = {**entry(sub, rank or len(ranked) + 1), "total": total}

    return {"data": data, "total": total, "own": own}


def _owns_submission(
    db: Session,
    form: Form,
    sub: Submission,
    request: Request,
    user: User | None,
    session_token: str | None,
) -> bool:
    """Kepemilikan submission untuk endpoint publik (aturan sama dengan
    _verify_submission_access di submissions router)."""
    if user and form.user_id == user.id:
        return True
    if sub.user_id and user and sub.user_id == user.id:
        return True
    if session_token and sub.access_token and secrets.compare_digest(session_token, sub.access_token):
        return True
    if not sub.access_token:
        client_ip = request.client.host if request.client else None
        if sub.ip_address and client_ip and sub.ip_address == client_ip:
            return True
    return False
