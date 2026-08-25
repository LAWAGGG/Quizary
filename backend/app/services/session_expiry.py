"""Session expiry for submissions.

A submission must never stay `in_progress` forever. Even forms without a timer
get a 24h ceiling on top of the timer/end-date, and a lazy sweep auto-submits
any in-progress submission past its deadline the next time the form or its
results are accessed.
"""
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.submission import Submission, SubmissionStatus
from app.services.grading import grade_submission
from app.utils import now_wib

MAX_SESSION_HOURS = 24


def expired_at(sub: Submission, form: Form):
    started = sub.started_at
    if not started:
        return None
    cap = started + timedelta(hours=MAX_SESSION_HOURS)
    exp = started + timedelta(seconds=form.timer_seconds) if form.timer_seconds else None
    if exp:
        exp = min(exp, cap)
    ends = form.ends_at
    if exp and ends:
        return min(exp, ends)
    if exp:
        return exp
    if ends:
        return min(ends, cap)
    return cap


def display_deadline(sub: Submission, form: Form):
    """Batas waktu untuk DITAMPILKAN ke responden: hanya timer creator atau
    end date jadwal. Batas internal 24 jam anti-sesi zombie tidak diekspos —
    tanpa keduanya, responden tidak perlu melihat countdown."""
    started = sub.started_at
    if not started:
        return None
    exp = started + timedelta(seconds=form.timer_seconds) if form.timer_seconds else None
    ends = form.ends_at
    if exp and ends:
        return min(exp, ends)
    return exp or ends


def is_expired(sub: Submission, form: Form) -> bool:
    exp = expired_at(sub, form)
    return exp is not None and now_wib() > exp


def auto_submit_expired_for_form(db: Session, form: Form) -> int:
    """Lazy sweep: auto-submit every in-progress submission past its deadline."""
    now = now_wib()
    count = 0
    subs = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status == SubmissionStatus.in_progress,
    ).all()
    for s in subs:
        if is_expired(s, form):
            s.status = SubmissionStatus.auto_submitted
            s.submitted_at = now
            grade_submission(db, s, form)
            count += 1
    if count:
        db.commit()
    return count
