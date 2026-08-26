"""Shared quiz grading logic.

`Answer.is_correct` / `points_earned` are the only places scoring state lives.
They used to be written on ONE path (`POST /submissions/{id}/submit`); any
session auto-submitted by expiry skipped grading, leaving `is_correct` NULL —
which cascaded into zero per-question analytics and empty exports. Everything
that finishes a submission now routes through these helpers so no path can
leave a submission ungraded. `grade_answer` is also used at analytics read-time
so historical rows self-heal instead of showing stale zeros.
"""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.submission import Submission


GRADABLE_TYPES = (
    QuestionType.multiple_choice,
    QuestionType.checkbox,
    QuestionType.dropdown,
    QuestionType.short_answer,
    QuestionType.password,
)


def max_score_for(questions) -> float:
    """Total poin maksimal yang benar-benar bisa diraih.

    Hanya soal `is_scored` dengan tipe yang dinilai otomatis. Essay/date/time/
    file_upload selalu 0 poin — kalau data lama membawa poin, tidak ikut
    menambah max_score (mencegah persen ≠ nilai mentah, mis. 67/102).
    """
    return float(sum(
        q.points or 0 for q in questions
        if q.is_scored and q.type in GRADABLE_TYPES
    ))


def grade_answer(answer: Answer, question: Question):
    """Return (is_correct, points_earned) for a stored answer vs its question.

    Mirrors the original submit-time rules exactly:
      - unscored questions (or essay) -> (None, 0)
      - multiple_choice / checkbox     -> +points when selected == correct set
      - short_answer                   -> +points when text is non-empty
    """
    if not question.is_scored:
        return None, Decimal("0")

    if question.type in (QuestionType.multiple_choice, QuestionType.checkbox, QuestionType.dropdown):
        correct_ids = {o.id for o in question.options if o.is_correct}
        selected_ids = {ao.option_id for ao in answer.selected_options}
        if correct_ids and selected_ids == correct_ids:
            return True, Decimal(str(question.points or 0))
        return False, Decimal("0")

    if question.type == QuestionType.short_answer:
        if answer.answer_text and answer.answer_text.strip():
            return True, Decimal(str(question.points or 0))
        return False, Decimal("0")

    # password: exact match, case-sensitive (keputusan creator — tanpa trim).
    if question.type == QuestionType.password:
        if question.password_keyword is not None and answer.answer_text == question.password_keyword:
            return True, Decimal(str(question.points or 0))
        return False, Decimal("0")

    return None, Decimal("0")


def grade_submission(db: Session, sub: Submission, form: Form):
    """Recompute correctness + score for every answer in a submission.

    Returns (total_score, max_score). Persists is_correct/points_earned and the
    submission totals but does NOT touch `status` or `submitted_at` — the caller
    owns the lifecycle transition (submit vs auto-submit).
    """
    questions = db.query(Question).filter(Question.form_id == form.id).all()
    q_map = {q.id: q for q in questions}
    max_score = max_score_for(questions)
    total = 0.0

    for answer in db.query(Answer).filter(Answer.submission_id == sub.id).all():
        q = q_map.get(answer.question_id)
        if not q:
            continue
        correct, points = grade_answer(answer, q)
        answer.is_correct = correct
        answer.points_earned = points
        total += float(points)

    sub.score = Decimal(str(total))
    sub.max_score = Decimal(str(max_score))
    return total, max_score