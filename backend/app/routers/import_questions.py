import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import verify_form_owner
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.schemas.results import (
    ImportTextRequest,
    ImportedQuestion,
    ImportedOption,
    ImportPreviewResponse,
    ImportConfirmResponse,
)

router = APIRouter(tags=["import"])


def _parse_text(raw: str) -> tuple[list[ImportedQuestion], int]:
    questions = []
    blocks = re.split(r'\n\s*(?=\d+\.)', raw.strip())
    invalid = 0

    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n")
        q_text = None
        options = []
        answer_letter = None

        for line in lines:
            line = line.strip()
            if not line:
                continue
            m = re.match(r'\d+\.\s*(.+)', line)
            if m:
                q_text = m.group(1).strip()
                continue
            m = re.match(r'([A-D])[\.\)]\s*(.+)', line)
            if m:
                letter, opt_text = m.group(1), m.group(2).strip()
                options.append((letter, opt_text))
                continue
            m = re.match(r'Jawaban\s*[:\-]?\s*([A-D])', line, re.IGNORECASE)
            if m:
                answer_letter = m.group(1).upper()

        if q_text and options:
            parsed_opts = []
            for letter, opt_text in options:
                parsed_opts.append(ImportedOption(
                    text=opt_text, is_correct=(letter == answer_letter),
                ))
            questions.append(ImportedQuestion(question_text=q_text, options=parsed_opts))
        else:
            invalid += 1

    return questions, invalid


@router.post("/forms/{form_id}/import/text", response_model=ImportPreviewResponse)
def import_text(
    body: ImportTextRequest,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    questions, invalid = _parse_text(body.raw_text)
    return ImportPreviewResponse(preview=questions, valid_count=len(questions), invalid_count=invalid)


@router.post("/forms/{form_id}/import/docx", response_model=ImportPreviewResponse)
async def import_docx(
    form: Form = Depends(verify_form_owner),
    file: UploadFile = File(...),
):
    import io
    from docx import Document

    content = await file.read()
    doc = Document(io.BytesIO(content))
    raw = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    questions, invalid = _parse_text(raw)
    return ImportPreviewResponse(preview=questions, valid_count=len(questions), invalid_count=invalid)


@router.post("/forms/{form_id}/import/confirm", response_model=ImportConfirmResponse)
def import_confirm(
    body: ImportPreviewResponse,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    count = 0
    for q_data in body.preview:
        q = Question(
            form_id=form.id,
            type=QuestionType.multiple_choice if q_data.options else QuestionType.essay,
            question_text=q_data.question_text,
            points=1,
            order_index=0 if q_data.options else 0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(q)
        db.flush()
        for i, opt in enumerate(q_data.options):
            db.add(QuestionOption(
                question_id=q.id, option_text=opt.text,
                is_correct=opt.is_correct, order_index=i,
            ))
        count += 1

    db.commit()
    return ImportConfirmResponse(message=f"{count} soal berhasil diimpor", imported_count=count)
