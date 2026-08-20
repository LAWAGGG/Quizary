from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi import UploadFile, File
import os
import uuid
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.form import Form
from app.models.image import Image
from app.models.question import Question, QuestionType, Section
from app.models.question_option import QuestionOption
from app.models.user import User
from app.services.points import distribute_quiz_points
from app.utils import file_url, now_wib, _delete_file, UPLOAD_DIR
from app.schemas.question import (
    QuestionCreate,
    QuestionUpdate,
    ReorderRequest,
    SectionCreate,
    SectionUpdate,
    SectionReorderRequest,
)

router = APIRouter(tags=["questions"])

_OPTION_TYPES = ("multiple_choice", "checkbox", "dropdown")
_TEXT_TYPES = ("short_answer", "essay", "date", "time", "file_upload")
# Types yang tidak pernah dinilai otomatis (tanpa options / tanpa isi teks dinilai)
_NO_GRADE_TYPES = ("essay", "date", "time", "file_upload")


def _get_question_or_404(q_id: int, db: Session) -> Question:
    q = db.get(Question, q_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return q


def _ensure_owner(q: Question, user: User, db: Session) -> Form:
    form = db.get(Form, q.form_id)
    if not form or form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")
    return form


def _image_obj(img, request: Request) -> dict | None:
    """Fix #5 — return single image object (first image only), not an array."""
    if img is None:
        return None
    return {"id": img.id, "path": file_url(request, img.path)}


def _build_question(q: Question, request: Request) -> dict:
    """
    Serialize a Question.
    Fix #5: `image` is a single object (first image) on both question and each option.
    """
    q_img = sorted(q.images, key=lambda i: i.order_index or 0)
    opts = []
    for opt in sorted(q.options, key=lambda o: o.order_index or 0):
        opt_imgs = sorted(opt.images, key=lambda i: i.order_index or 0)
        opts.append({
            "id": opt.id,
            "option_text": opt.option_text,
            "is_correct": opt.is_correct,
            "order_index": opt.order_index,
            "image": _image_obj(opt_imgs[0], request) if opt_imgs else None,
        })
    return {
        "id": q.id,
        "type": q.type.value,
        "question_text": q.question_text,
        "points": q.points,
        "is_scored": q.is_scored,
        "order_index": q.order_index,
        "is_required": q.is_required,
        "section_id": q.section_id,
        "options": opts,
        "image": _image_obj(q_img[0], request) if q_img else None,
    }


# ── GET /forms/{form_id}/questions ────────────────────────────────────────────

@router.get("/forms/{form_id}/questions")
def list_questions(
    request: Request,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    questions = (
        db.query(Question)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index)
        .all()
    )
    return {"data": [_build_question(q, request) for q in questions]}


# ── Sections (kelompok soal per halaman) ─────────────────────────────────────

def _get_section_or_404(section_id: int, db: Session) -> Section:
    section = db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section tidak ditemukan")
    return section


# ── PATCH /sections/reorder ──────────────────────────────────────────────────
# Declared BEFORE /sections/{section_id} — FastAPI matches routes in definition
# order, so "/sections/reorder" must not be captured as a path param.

@router.patch("/sections/reorder")
def reorder_sections(
    body: SectionReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    form = db.get(Form, body.form_id)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")

    section_ids = {row[0] for row in db.query(Section.id).filter(Section.form_id == form.id).all()}
    if set(body.orders) != section_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="orders must include exactly all sections in this form",
        )

    for idx, s_id in enumerate(body.orders):
        s = db.get(Section, s_id)
        if not s or s.form_id != body.form_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Section {s_id} not found in this form",
            )
        s.order_index = idx

    db.commit()
    return {"message": "Section order updated"}


def _section_dict(section: Section) -> dict:
    return {
        "id": section.id,
        "title": section.title,
        "order_index": section.order_index,
        "question_count": len(section.questions),
    }


@router.get("/forms/{form_id}/sections")
def list_sections(
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    sections = (
        db.query(Section)
        .filter(Section.form_id == form.id)
        .order_by(Section.order_index)
        .all()
    )
    return {"data": [_section_dict(s) for s in sections]}


@router.post("/forms/{form_id}/sections", status_code=201)
def create_section(
    body: SectionCreate,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    max_order = (
        db.query(Section.order_index)
        .filter(Section.form_id == form.id)
        .order_by(Section.order_index.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    section = Section(
        form_id=form.id,
        title=body.title,
        order_index=next_order,
        created_at=now_wib(),
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return _section_dict(section)


@router.patch("/sections/{section_id}")
def update_section(
    section_id: int,
    body: SectionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    section = _get_section_or_404(section_id, db)
    form = db.get(Form, section.form_id)
    if not form or form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik form ini")
    if body.title is not None:
        section.title = body.title
    db.commit()
    db.refresh(section)
    return _section_dict(section)


@router.delete("/sections/{section_id}")
def delete_section(
    section_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    section = _get_section_or_404(section_id, db)
    form = db.get(Form, section.form_id)
    if not form or form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik form ini")
    db.delete(section)
    db.commit()
    return {"message": "Section dihapus"}


# ── POST /forms/{form_id}/questions ───────────────────────────────────────────

@router.post("/forms/{form_id}/questions", status_code=201)
def create_question(
    request: Request,
    body: QuestionCreate,
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    max_order = (
        db.query(Question.order_index)
        .filter(Question.form_id == form.id)
        .order_by(Question.order_index.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    if body.section_id is not None:
        section = db.get(Section, body.section_id)
        if not section or section.form_id != form.id:
            raise HTTPException(status_code=422, detail="Section tidak ditemukan pada form ini")

    # multiple_choice hanya wajib punya tepat 1 jawaban benar untuk quiz yang
    # dinilai (count points). Form biasa / kuesioner & soal tidak dinilai bebas.
    if form.type.value == "quiz" and body.type == "multiple_choice":
        correct_count = sum(1 for o in body.options if o.is_correct)
        if correct_count != 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="multiple_choice questions must have exactly 1 correct option",
            )

    question = Question(
        form_id=form.id,
        type=QuestionType(body.type),
        question_text=body.question_text,
        points=0 if form.type.value == "quiz" else body.points,
        is_required=body.is_required,
        section_id=body.section_id,
        order_index=next_order,
        created_at=now_wib(),
    )
    db.add(question)
    db.flush()

    for i, opt in enumerate(body.options):
        db.add(QuestionOption(
            question_id=question.id,
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=i,
        ))

    distribute_quiz_points(form.id, db)
    db.commit()
    db.refresh(question)
    return _build_question(question, request)


# ── PUT /questions/{question_id} ──────────────────────────────────────────────

@router.put("/questions/{question_id}")
def update_question(
    request: Request,
    body: QuestionUpdate,
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    form = _ensure_owner(question, user, db)

    update_data = body.model_dump(exclude_unset=True)
    options_data = update_data.pop("options", None)

    if update_data.get("section_id") is not None:
        section = db.get(Section, update_data["section_id"])
        if not section or section.form_id != question.form_id:
            raise HTTPException(status_code=422, detail="Section tidak ditemukan pada form ini")

    # Determine the effective type after this update
    new_type_str = update_data.get("type") or question.type.value

    # Fix #4 — non-empty options with a text type is invalid; an empty list is
    # allowed and simply means "clear options" (e.g. switching MC → short_answer).
    if options_data:
        if new_type_str in _TEXT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question type '{new_type_str}' cannot have options",
            )

    # Fix #4 — if switching to a text type, options must be explicitly cleared in DB
    if "type" in update_data:
        new_type = QuestionType(update_data.pop("type"))
        # Switching FROM option type TO text type → delete all existing options,
        # but never options already chosen by respondents (would corrupt answers).
        if new_type.value in _TEXT_TYPES and question.type.value in _OPTION_TYPES:
            for opt in list(question.options):
                if db.query(AnswerOption).filter(AnswerOption.option_id == opt.id).count() > 0:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Opsi \"{opt.option_text}\" tidak dapat dihapus karena sudah dipilih peserta",
                    )
            for opt in list(question.options):
                db.delete(opt)
            db.flush()
        # Switching FROM text type TO option type but no options provided → error
        if new_type.value in _OPTION_TYPES and question.type.value in _TEXT_TYPES and not options_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Switching to '{new_type.value}' requires at least 1 option in this request",
            )
        question.type = new_type

    # Toggle is_scored: off → force 0 points; on (no explicit points) → rejoin pool
    was_scored = question.is_scored
    if "is_scored" in update_data:
        if update_data["is_scored"] is False:
            update_data["points"] = 0
        elif "points" not in update_data:
            update_data["points"] = 0

    # Quiz pool = 100 (distribute_quiz_points). A fixed points value > 100
    # would zero out every other scored question — reject instead.
    if question.type.value not in _NO_GRADE_TYPES and update_data.get("points", 0) > 100:
        form_type = db.get(Form, question.form_id)
        if form_type and form_type.type.value == "quiz":
            raise HTTPException(status_code=422, detail="Poin per soal maksimal 100")

    # Essay & non-graded types never carry points (grade_answer returns None/0)
    if question.type.value in _NO_GRADE_TYPES:
        update_data["points"] = 0

    for field, value in update_data.items():
        setattr(question, field, value)

    question.updated_at = now_wib()

    # Handle options update (only for option-type questions)
    if options_data is not None:
        existing_ids = {o.id for o in question.options}
        seen_ids: set[int] = set()
        new_opts = []

        for opt_dict in options_data:
            opt_id = opt_dict.get("id")
            if opt_id:
                if opt_id in existing_ids:
                    seen_ids.add(opt_id)
                    opt = db.get(QuestionOption, opt_id)
                    if opt_dict.get("option_text") is not None:
                        opt.option_text = opt_dict["option_text"]
                    if opt_dict.get("is_correct") is not None:
                        opt.is_correct = opt_dict["is_correct"]
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Option {opt_id} not found in this question",
                    )
            else:
                new_opts.append(opt_dict)

        for opt in list(question.options):
            if opt.id not in seen_ids:
                if db.query(AnswerOption).filter(AnswerOption.option_id == opt.id).count() > 0:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Opsi \"{opt.option_text}\" tidak dapat dihapus karena sudah dipilih peserta",
                    )
                db.delete(opt)

        db.flush()
        remaining = db.query(QuestionOption).filter(QuestionOption.question_id == question.id).count()
        for i, opt_dict in enumerate(new_opts):
            db.add(QuestionOption(
                question_id=question.id,
                option_text=opt_dict.get("option_text", ""),
                is_correct=opt_dict.get("is_correct", False),
                order_index=remaining + i,
            ))

        # Fix #3 carry-over — re-validate mc has exactly 1 correct after update
        # (hanya untuk quiz yang dinilai; form biasa/kuesioner & soal tidak
        # dinilai boleh tanpa jawaban benar)
        db.flush()
        if new_type_str == "multiple_choice" and form.type.value == "quiz" and question.is_scored:
            correct_count = db.query(QuestionOption).filter(
                QuestionOption.question_id == question.id,
                QuestionOption.is_correct == True,  # noqa: E712
            ).count()
            if correct_count != 1:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="multiple_choice questions must have exactly 1 correct option",
                )

    if question.is_scored and not was_scored:
        distribute_quiz_points(question.form_id, db)
    elif question.is_scored:
        distribute_quiz_points(question.form_id, db, fixed_ids={question.id})
    else:
        distribute_quiz_points(question.form_id, db)
    db.commit()
    db.refresh(question)
    return _build_question(question, request)


# ── DELETE /questions/{question_id} ───────────────────────────────────────────

@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)
    if db.query(Answer).filter(Answer.question_id == question.id).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Soal tidak dapat dihapus karena sudah memiliki jawaban",
        )
    for img in question.images:
        _delete_file(img.path)
    for opt in question.options:
        for img in opt.images:
            _delete_file(img.path)
    form_id = question.form_id
    db.delete(question)
    distribute_quiz_points(form_id, db)
    db.commit()
    return {"message": "Question deleted"}


# ── PATCH /questions/reorder ──────────────────────────────────────────────────

@router.patch("/questions/reorder")
def reorder_questions(
    body: ReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    form = db.get(Form, body.form_id)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")

    form_ids = {row[0] for row in db.query(Question.id).filter(Question.form_id == form.id).all()}
    if set(body.orders) != form_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="orders must include exactly all questions in this form",
        )

    for idx, q_id in enumerate(body.orders):
        q = db.get(Question, q_id)
        if not q or q.form_id != body.form_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question {q_id} not found in this form",
            )
        q.order_index = idx

    db.commit()
    return {"message": "Question order updated"}


_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".webm"}


def _store_image(file: UploadFile, subdir: str) -> str:
    """Save an image or audio upload and return relative path. `file` must be non-null."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(status_code=422, detail="Unsupported file format, use image (JPG/PNG/GIF/WEBP) or audio (MP3/WAV/M4A/OGG/AAC/WEBM)")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, subdir, filename)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(file.file.read())
    return f"{subdir}/{filename}"


def _replace_image(owner, subdir: str, file: UploadFile, db: Session, request: Request):
    """Upload (and replace) the single media (image/audio) for an owner (Question or QuestionOption)."""
    old = sorted(owner.images, key=lambda i: i.order_index or 0)
    new_path = _store_image(file, subdir)
    for img in old:
        _delete_file(img.path)
        db.delete(img)
    db.add(Image(question_id=owner.id if isinstance(owner, Question) else None,
                 option_id=owner.id if isinstance(owner, QuestionOption) else None,
                 path=new_path, order_index=0, created_at=now_wib()))
    db.commit()
    return file_url(request, new_path)


# ── Upload images ─────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/option/{option_id}/image", status_code=201)
def upload_option_image(
    question_id: int,
    option_id: int,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)
    opt = db.get(QuestionOption, option_id)
    if not opt or opt.question_id != question_id:
        raise HTTPException(status_code=404, detail="Option not found in this question")
    url = _replace_image(opt, "options", file, db, request)
    return {"message": "Option image uploaded", "image": {"path": url}}


@router.post("/questions/{question_id}/image", status_code=201)
def upload_question_image(
    question_id: int,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(question_id, db)
    _ensure_owner(question, user, db)
    url = _replace_image(question, "questions", file, db, request)
    return {"message": "Question image uploaded", "image": {"path": url}}
