import re
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import verify_form_owner
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.routers.questions import _distribute_quiz_points

router = APIRouter(tags=["import"])


def _parse_text(raw: str) -> list[dict]:
    questions: list[dict] = []

    blocks = re.split(r'\n\s*(?=\d+[\.\)])', raw.strip())
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        q_text = None
        options: list[dict] = []
        answer_letter = None

        for line in block.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = re.match(r'\d+[\.\)]\s*(.+)', line)
            if m:
                q_text = m.group(1).strip()
                continue
            m = re.match(r'([A-Da-d])[\.\)]\s*(.+)', line)
            if m:
                letter = m.group(1).upper()
                text = m.group(2).strip()
                options.append({"letter": letter, "text": text})
                continue
            m = re.match(r'(?:Kunci\s*)?(?:Jawaban|Jawab|Answer)\s*[:\-]?\s*([A-Da-d])', line, re.IGNORECASE)
            if m:
                answer_letter = m.group(1).upper()

        if q_text and options:
            questions.append({
                "question_text": q_text,
                "options": [
                    {"text": opt["text"], "is_correct": opt["letter"] == answer_letter}
                    for opt in options
                ],
            })

    return questions


@router.post("/forms/{form_id}/import/docx", status_code=201)
async def import_docx(
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .docx files are supported",
        )

    try:
        from docx import Document  # type: ignore
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="python-docx is not installed",
        )

    content = await file.read()
    doc = Document(io.BytesIO(content))
    raw = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    parsed = _parse_text(raw)

    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No questions could be imported, check document format",
        )

    max_order = (
        db.query(Question.order_index)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    now = datetime.utcnow()
    count = 0

    for q_data in parsed:
        has_options = bool(q_data["options"])
        correct_count = sum(1 for o in q_data["options"] if o["is_correct"])

        if has_options and correct_count > 1:
            q_type = QuestionType.checkbox
        elif has_options:
            q_type = QuestionType.multiple_choice
        else:
            q_type = QuestionType.essay

        q = Question(
            form_id=form.id,
            type=q_type,
            question_text=q_data["question_text"],
            points=0 if form.type.value == "quiz" else 1,
            order_index=next_order,
            created_at=now,
        )
        db.add(q)
        db.flush()

        for i, opt in enumerate(q_data["options"]):
            db.add(QuestionOption(
                question_id=q.id,
                option_text=opt["text"],
                is_correct=opt["is_correct"],
                order_index=i,
            ))

        next_order += 1
        count += 1

    _distribute_quiz_points(form.id, db)
    db.commit()
    return {"message": f"{count} question(s) imported successfully", "imported_count": count}
