import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import verify_form_owner
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.schemas.results import (
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportedQuestion,
    ImportedOption,
    ImportPreviewResponse,
    ImportTextRequest,
)

router = APIRouter(tags=["import"])


def _parse_text(raw: str) -> tuple[list[ImportedQuestion], int]:
    """
    Parse raw text into questions using this template:
      1. Question text
      A. Option A
      B. Option B
      Jawaban: A
    Returns (questions, invalid_count).
    """
    questions: list[ImportedQuestion] = []
    invalid = 0

    blocks = re.split(r'\n\s*(?=\d+\.)', raw.strip())
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        q_text: str | None = None
        options: list[tuple[str, str]] = []
        answer_letter: str | None = None

        for line in block.split("\n"):
            line = line.strip()
            if not line:
                continue
            if m := re.match(r'\d+\.\s*(.+)', line):
                q_text = m.group(1).strip()
            elif m := re.match(r'([A-D])[\.\)]\s*(.+)', line):
                options.append((m.group(1), m.group(2).strip()))
            elif m := re.match(r'Jawaban\s*[:\-]?\s*([A-D])', line, re.IGNORECASE):
                answer_letter = m.group(1).upper()

        if q_text and options:
            questions.append(ImportedQuestion(
                question_text=q_text,
                options=[
                    ImportedOption(text=opt_text, is_correct=(letter == answer_letter))
                    for letter, opt_text in options
                ],
            ))
        else:
            invalid += 1

    return questions, invalid


@router.post("/forms/{form_id}/import/text", response_model=ImportPreviewResponse)
def import_text(
    body: ImportTextRequest,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    """Preview parsed questions from raw text. Nothing is saved yet."""
    if not body.raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="raw_text must not be empty",
        )
    questions, invalid = _parse_text(body.raw_text)
    return ImportPreviewResponse(preview=questions, valid_count=len(questions), invalid_count=invalid)


@router.post("/forms/{form_id}/import/docx", response_model=ImportPreviewResponse)
async def import_docx(
    form: Form = Depends(verify_form_owner),
    file: UploadFile = File(...),
):
    """Preview parsed questions from a .docx file. Nothing is saved yet."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .docx files are supported",
        )
    try:
        import io
        from docx import Document  # type: ignore
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="python-docx is not installed",
        )

    content = await file.read()
    doc = Document(io.BytesIO(content))
    raw = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    questions, invalid = _parse_text(raw)
    return ImportPreviewResponse(preview=questions, valid_count=len(questions), invalid_count=invalid)


@router.post("/forms/{form_id}/import/confirm", status_code=201, response_model=ImportConfirmResponse)
def import_confirm(
    body: ImportConfirmRequest,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    """Permanently save the confirmed questions to the form."""
    if not body.questions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="questions list must not be empty",
        )

    # Determine next order_index so imported questions append after existing ones
    max_order = (
        db.query(Question.order_index)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    count = 0
    now = datetime.utcnow()

    for q_data in body.questions:
        has_options = bool(q_data.options)
        correct_count = sum(1 for o in q_data.options if o.is_correct)

        if has_options and correct_count > 1:
            q_type = QuestionType.checkbox
        elif has_options:
            q_type = QuestionType.multiple_choice
        else:
            q_type = QuestionType.essay

        q = Question(
            form_id=form.id,
            type=q_type,
            question_text=q_data.question_text,
            points=1,
            order_index=next_order,
            created_at=now,
        )
        db.add(q)
        db.flush()

        for i, opt in enumerate(q_data.options):
            db.add(QuestionOption(
                question_id=q.id,
                option_text=opt.text,
                is_correct=opt.is_correct,
                order_index=i,
            ))

        next_order += 1
        count += 1

    db.commit()
    return ImportConfirmResponse(
        message=f"{count} question(s) imported successfully",
        imported_count=count,
    )
