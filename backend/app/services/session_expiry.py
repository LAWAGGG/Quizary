"""Session expiry for submissions.

A submission must never stay `in_progress` forever. Even forms without a timer
get a 24h ceiling on top of the timer/end-date, and a lazy sweep auto-submits
any in-progress submission past its deadline the next time the form or its
results are accessed.
"""
from datetime import timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.submission import Submission, SubmissionStatus
from app.models.question import Question
from app.models.answer import Answer
from app.services.grading import grade_submission, max_score_for
from app.utils import now_wib

MAX_SESSION_HOURS = 24
# Fallback anti-cheat: creator tidak memutuskan submission `locked` dalam
# 5 menit → otomatis difinalisasi curang (nilai 0). Waktu lock = updated_at.
LOCK_DECISION_MINUTES = 5


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


def finalize_locked(db: Session, sub: Submission, form: Form, *, commit: bool = True) -> bool:
    """Fallback: submission `locked` tak diputuskan creator dalam 5 menit →
    otomatis cheating (nilai 0). Return True kalau finalisasi terjadi."""
    if sub.status != SubmissionStatus.locked:
        return False
    if sub.updated_at and (now_wib() - sub.updated_at).total_seconds() < LOCK_DECISION_MINUTES * 60:
        return False
    sub.status = SubmissionStatus.cheating
    sub.submitted_at = now_wib()
    # ponytail: cheating selalu 0, skip grade_submission heavy (N query)
    # cukup set max_score cepat 1 query, per-answer is_correct tidak penting untuk cheating
    try:
        qs = db.query(Question).filter(Question.form_id == form.id, Question.is_deleted.is_(False)).all()
        sub.max_score = max_score_for(qs, form.scoring_mode.value if form.scoring_mode else "auto")
    except Exception:
        pass
    sub.score = Decimal("0")
    if commit:
        db.commit()
    return True


def is_expired(sub: Submission, form: Form) -> bool:
    exp = expired_at(sub, form)
    return exp is not None and now_wib() > exp


def auto_submit_expired_for_form(db: Session, form: Form) -> int:
    """Lazy sweep: auto-submit submission in_progress yang lewat deadline,
    dan finalisasi locked yang tidak diputuskan creator dalam 5 menit."""
    now = now_wib()
    subs = db.query(Submission).filter(
        Submission.form_id == form.id,
        Submission.status.in_([SubmissionStatus.in_progress, SubmissionStatus.locked]),
    ).all()
    if not subs:
        return 0
    # ponytail: preload questions sekali untuk semua grading, bulk answers untuk expired
    # hindari N * (Q+A) query di loop
    questions = None
    q_map = None
    answers_by_sub = {}
    # kumpulkan id yang perlu grading (expired in_progress)
    expired_ids = []
    for s in subs:
        if s.status == SubmissionStatus.in_progress and is_expired(s, form):
            expired_ids.append(s.id)
    if expired_ids:
        # preload Questions + Answers sekali
        from sqlalchemy.orm import selectinload
        # questions dengan options & images tidak perlu untuk expired grading? but grade_submission butuh
        # cukup preload via grade_submission yang akan query lagi — untuk ponytail, biarkan grade_submission tetap query per sub
        # tapi bulk fetch answers untuk kurangi N
        answers = db.query(Answer).filter(Answer.submission_id.in_(expired_ids)).all()
        for a in answers:
            answers_by_sub.setdefault(a.submission_id, []).append(a)
        questions = db.query(Question).filter(Question.form_id == form.id, Question.is_deleted.is_(False)).all()
        q_map = {q.id: q for q in questions}

    count = 0
    for s in subs:
        if s.status == SubmissionStatus.locked:
            if finalize_locked(db, s, form, commit=False):
                count += 1
        elif s.id in answers_by_sub or (s.status == SubmissionStatus.in_progress and is_expired(s, form)):
            # sudah terfilter expired_ids, tapi cek lagi untuk yang belum masuk answers_by_sub (tanpa jawaban)
            if s.status == SubmissionStatus.in_progress and is_expired(s, form):
                s.status = SubmissionStatus.auto_submitted
                s.submitted_at = now
                # ponytail: grading pakai preloaded q_map/answers jika ada, else fallback grade_submission
                if q_map is not None:
                    # manual grading tanpa query tambahan
                    from app.services.grading import grade_answer, max_score_for as _max
                    from decimal import Decimal as _Dec
                    scoring_mode = form.scoring_mode.value if form.scoring_mode else "auto"
                    max_sc = _max(questions, scoring_mode=scoring_mode)
                    total = 0.0
                    for ans in answers_by_sub.get(s.id, []):
                        q = q_map.get(ans.question_id)
                        if not q:
                            continue
                        correct, pts = grade_answer(ans, q)
                        ans.is_correct = correct
                        ans.points_earned = pts
                        total += float(pts)
                    s.score = _Dec(str(total))
                    s.max_score = _Dec(str(max_sc))
                else:
                    grade_submission(db, s, form)
                count += 1
    if count:
        db.commit()
    return count
