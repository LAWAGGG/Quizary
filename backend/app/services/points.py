from app.models.form import Form
from app.models.question import Question, QuestionType


def distribute_quiz_points(form_id: int, db, fixed_ids: set[int] | None = None) -> None:
    """Rebalance quiz points so all scored questions total 100.

    - `fixed_ids=None` (add / delete / import / toggle-on): every scored
      question gets an equal share of the 100 pool.
    - `fixed_ids={qid}` (points edited): that question keeps its current
      points and the remaining pool is split equally among the others.
    - `is_scored=false` questions are excluded entirely (detail-only).
    - Essay questions are excluded too: they are never graded (see grading.py),
      so allocating them points would inflate max_score beyond what a
      respondent can reach.
    """
    form = db.get(Form, form_id)
    if not form or form.type.value != "quiz":
        return
    # Session runs with autoflush=False — flush pending points/is_scored/deletes
    # first so the query below sees the current state.
    db.flush()
    questions = (
        db.query(Question)
        .filter(
            Question.form_id == form_id,
            Question.is_scored.is_(True),
            Question.type.notin_([QuestionType.essay, QuestionType.date, QuestionType.time, QuestionType.file_upload]),
        )
        .order_by(Question.order_index, Question.id)
        .all()
    )
    if not questions:
        return

    if fixed_ids:
        fixed = [q for q in questions if q.id in fixed_ids]
        others = [q for q in questions if q.id not in fixed_ids]
        if not others:
            return
        remaining = 100 - sum(q.points for q in fixed)
        if remaining <= 0:
            for q in others:
                q.points = 0
            return
        base = remaining // len(others)
        rem = remaining % len(others)
        for i, q in enumerate(others):
            q.points = base + (1 if i < rem else 0)
    else:
        base = 100 // len(questions)
        rem = 100 % len(questions)
        for i, q in enumerate(questions):
            q.points = base + (1 if i < rem else 0)
