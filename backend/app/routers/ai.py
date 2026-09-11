import asyncio
import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from fastapi import Form as ApiForm
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.ai_generation import AiGeneration
from app.models.form import DisplayStyle, Form, FormType, SubmissionLimit, ScoringMode
from app.models.question import Question, QuestionType, Section
from app.models.question_option import QuestionOption
from app.models.user import User
from app.routers.forms import _apply_setting_chain, _generate_short_code, _parse_enum
from app.routers.questions import _NO_GRADE_TYPES
from app.schemas.ai import AiAcceptRequest, AiAcceptResponse, AiGenerateResponse, AiQuotaResponse
from app.schemas.question import check_allow_other, check_answer_key
from app.services.ai_generate import (
    AI_DAILY_LIMIT,
    ALLOWED_REF_EXT,
    MAX_REF_FILES,
    MAX_REF_FILE_BYTES,
    AiFailed,
    AiNotConfigured,
    build_user_text,
    call_gemini,
    extract_ref_text,
    sanitize_draft,
    truncate_refs,
)
from app.services.points import distribute_quiz_points
from app.utils import now_wib, read_limited

router = APIRouter(tags=["ai"])


def _used_today(db: Session, user_id: int) -> int:
    start = now_wib().replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(AiGeneration)
        .filter(AiGeneration.user_id == user_id, AiGeneration.created_at >= start)
        .count()
    )


def _quota_or_429(db: Session, user_id: int) -> int:
    used = _used_today(db, user_id)
    if used >= AI_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Batas generate AI hari ini habis ({AI_DAILY_LIMIT}/hari). Coba lagi besok.",
        )
    return used


@router.get("/ai/quota", response_model=AiQuotaResponse)
def ai_quota(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    used = _used_today(db, user.id)
    return {"limit": AI_DAILY_LIMIT, "used": used, "remaining": max(0, AI_DAILY_LIMIT - used)}


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/ai/generate/stream")
async def ai_generate_stream(
    request: Request,
    title: str = ApiForm(...),
    description: str | None = ApiForm(None),
    type: str = ApiForm("form"),
    prompt: str = ApiForm(...),
    files: list[UploadFile] = File([]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """SSE progress untuk generate AI. Event: progress -> done | error.

    Kuota harian dicatat hanya saat done; client batal (disconnect) =
    tanpa kuota terpakai dan tanpa draft.
    """

    async def events():
        def err(msg: str, code: int = 502) -> str:
            return _sse("error", {"message": msg, "status": code})
        if type not in ("form", "quiz"):
            yield err("type harus 'form' atau 'quiz'", 422)
            return
        if not re.sub(r"<[^>]*>", "", title or "").strip():
            yield err("Title tidak boleh kosong", 422)
            return
        if len(title) > 1000:
            yield err("Title maksimal 1000 karakter", 422)
            return
        if description and len(description) > 5000:
            yield err("Description maksimal 5000 karakter", 422)
            return
        clean_prompt = (prompt or "").strip()
        if len(clean_prompt) < 10:
            yield err("Prompt minimal 10 karakter agar AI paham maumu", 422)
            return
        if len(clean_prompt) > 5000:
            yield err("Prompt maksimal 5000 karakter", 422)
            return
        if len(files) > MAX_REF_FILES:
            yield err(f"Maksimal {MAX_REF_FILES} file referensi", 422)
            return
        used = _used_today(db, user.id)
        if used >= AI_DAILY_LIMIT:
            yield err(f"Batas generate AI hari ini habis ({AI_DAILY_LIMIT}/hari). Coba lagi besok.", 429)
            return

        yield _sse("progress", {"stage": "reading", "done": 0, "total": len(files)})
        refs: list[tuple[str, str]] = []
        for i, f in enumerate(files):
            if await request.is_disconnected():
                return
            ext = Path(f.filename or "").suffix.lower()
            if ext not in ALLOWED_REF_EXT:
                yield err(f"Tipe file tidak didukung ({f.filename or 'tanpa nama'}). Pakai docx, pdf, atau pptx.", 422)
                return
            try:
                blob = await asyncio.to_thread(read_limited, f.file, MAX_REF_FILE_BYTES)
                text = await asyncio.to_thread(extract_ref_text, f.filename or "referensi", blob)
            except HTTPException:
                yield err(f"File {f.filename or ''} terlalu besar. Maksimal 5MB per file.", 413)
                return
            except Exception:
                yield err(f"File {f.filename or ''} tidak bisa dibaca.", 422)
                return
            text = (text or "").strip()
            if not text:
                yield err(f"File {f.filename or ''} kosong atau tidak ada teksnya.", 422)
                return
            refs.append((f.filename or "referensi", text))
            yield _sse("progress", {"stage": "reading", "done": i + 1, "total": len(files)})
        refs = truncate_refs(refs)

        yield _sse("progress", {"stage": "generating"})
        task = asyncio.create_task(
            asyncio.to_thread(call_gemini, build_user_text(title, description, type, clean_prompt, refs), user.id)
        )
        while not task.done():
            await asyncio.sleep(15)
            if await request.is_disconnected():
                task.cancel()
                return
            yield ": ping\n\n"
        try:
            raw, model_used = task.result()
        except AiNotConfigured:
            yield err("Fitur AI belum dikonfigurasi server. Hubungi admin.", 503)
            return
        except AiFailed as e:
            yield err(str(e), 502)
            return
        except Exception:
            yield err("AI tidak merespons. Periksa koneksi lalu coba lagi.", 502)
            return

        yield _sse("progress", {"stage": "sanitizing"})
        try:
            draft = await asyncio.to_thread(sanitize_draft, raw, type, clean_prompt)
        except AiFailed as e:
            yield err(str(e), 502)
            return
        if await request.is_disconnected():
            return
        db.add(AiGeneration(user_id=user.id, created_at=now_wib()))
        db.commit()
        left = AI_DAILY_LIMIT - (used + 1)
        ignored = draft.pop("ignored", []) if isinstance(draft, dict) else []
        yield _sse(
            "done",
            {"draft": draft, "model": model_used, "remaining": max(0, left), "limit": AI_DAILY_LIMIT, "ignored": ignored},
        )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/ai/generate", response_model=AiGenerateResponse)
def ai_generate(
    title: str = ApiForm(...),
    description: str | None = ApiForm(None),
    type: str = ApiForm("form"),
    prompt: str = ApiForm(...),
    files: list[UploadFile] = File([]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if type not in ("form", "quiz"):
        raise HTTPException(status_code=422, detail="type harus 'form' atau 'quiz'")
    if not re.sub(r"<[^>]*>", "", title or "").strip():
        raise HTTPException(status_code=422, detail="Title tidak boleh kosong")
    if len(title) > 1000:
        raise HTTPException(status_code=422, detail="Title maksimal 1000 karakter")
    if description and len(description) > 5000:
        raise HTTPException(status_code=422, detail="Description maksimal 5000 karakter")
    prompt = (prompt or "").strip()
    if len(prompt) < 10:
        raise HTTPException(status_code=422, detail="Prompt minimal 10 karakter agar AI paham maumu")
    if len(prompt) > 5000:
        raise HTTPException(status_code=422, detail="Prompt maksimal 5000 karakter")
    if len(files) > MAX_REF_FILES:
        raise HTTPException(status_code=422, detail=f"Maksimal {MAX_REF_FILES} file referensi")

    used = _quota_or_429(db, user.id)

    refs: list[tuple[str, str]] = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_REF_EXT:
            raise HTTPException(status_code=422, detail=f"Tipe file tidak didukung ({f.filename or 'tanpa nama'}). Pakai docx, pdf, atau pptx.")
        try:
            text = extract_ref_text(f.filename or "referensi", read_limited(f.file, MAX_REF_FILE_BYTES))
        except HTTPException:
            raise HTTPException(status_code=413, detail=f"File {f.filename or ''} terlalu besar. Maksimal 5MB per file.")
        except Exception:
            raise HTTPException(status_code=422, detail=f"File {f.filename or ''} tidak bisa dibaca.")
        text = (text or "").strip()
        if not text:
            raise HTTPException(status_code=422, detail=f"File {f.filename or ''} kosong atau tidak ada teksnya.")
        refs.append((f.filename or "referensi", text))
    refs = truncate_refs(refs)

    try:
        raw, model_used = call_gemini(
            build_user_text(title, description, type, prompt, refs),
            user_id=user.id,
        )
        draft = sanitize_draft(raw, type, prompt)
    except AiNotConfigured:
        raise HTTPException(status_code=503, detail="Fitur AI belum dikonfigurasi server. Hubungi admin.")
    except AiFailed as e:
        raise HTTPException(status_code=502, detail=str(e))

    db.add(AiGeneration(user_id=user.id, created_at=now_wib()))
    db.commit()
    left = AI_DAILY_LIMIT - (used + 1)
    ignored = draft.pop("ignored", []) if isinstance(draft, dict) else []
    return {"draft": draft, "model": model_used, "remaining": max(0, left), "limit": AI_DAILY_LIMIT, "ignored": ignored}


@router.post("/ai/accept", status_code=201, response_model=AiAcceptResponse)
def ai_accept(body: AiAcceptRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    is_quiz = body.type == "quiz"
    if is_quiz and not body.settings.timer_minutes:
        raise HTTPException(status_code=422, detail="Kuis wajib punya timer. Minta AI menyertakan timer_minutes lalu generate ulang.")
    for si, sec in enumerate(body.sections):
        for qi, q in enumerate(sec.questions):
            if is_quiz and q.type == "multiple_choice":
                correct = sum(1 for o in q.options if o.is_correct)
                if correct != 1:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Soal pilihan ganda harus tepat 1 jawaban benar (bagian {si + 1} soal {qi + 1}). Perbaiki prompt lalu generate ulang.",
                    )

    settings = _apply_setting_chain(
        {"is_restricted": body.settings.is_restricted, "submission_limit": body.settings.submission_limit, "require_login": body.settings.require_login},
        Form(is_restricted=body.settings.is_restricted, submission_limit=body.settings.submission_limit),
    )
    now = now_wib()
    form = Form(
        user_id=user.id,
        title=body.title,
        description=body.description,
        type=_parse_enum(body.type, FormType, "type"),
        display_style=_parse_enum(body.settings.display_style, DisplayStyle, "display_style"),
        require_login=settings["require_login"],
        submission_limit=_parse_enum(settings["submission_limit"], SubmissionLimit, "submission_limit"),
        scoring_mode=_parse_enum(body.settings.scoring_mode if is_quiz else "auto", ScoringMode, "scoring_mode"),
        timer_seconds=body.settings.timer_minutes * 60 if body.settings.timer_minutes else None,
        shuffle_questions=body.settings.shuffle_questions,
        shuffle_options=body.settings.shuffle_options,
        show_leaderboard=body.settings.show_leaderboard if is_quiz else False,
        is_restricted=settings["is_restricted"],
        show_in_history=body.settings.show_in_history,
        reveal_score=body.settings.reveal_score,
        reveal_answers=body.settings.reveal_answers,
        starts_at=body.settings.starts_at,
        ends_at=body.settings.ends_at,
        short_code=_generate_short_code(db),
        created_at=now,
        updated_at=now,
    )
    # B-light: group/wacana nonaktif — tidak ada inject passage duplikat
    # (semua soal standalone, --- dilarang di prompt & di-strip di _coerce_question)
    for sec in body.sections:
        for q in sec.questions:
            q.group_id = None
            if "\n\n---\n\n" in q.question_text:
                q.question_text = q.question_text.split("\n\n---\n\n")[-1].strip()
            if " --- " in q.question_text:
                q.question_text = q.question_text.split(" --- ")[-1].strip()

    try:
        db.add(form)
        db.flush()
        order = 0
        for si, sec in enumerate(body.sections):
            section = Section(form_id=form.id, title=sec.title, order_index=si, created_at=now)
            db.add(section)
            db.flush()
            for q in sec.questions:
                # Validasi tipe kunci/flag sudah lolos di parsing QuestionCreate;
                # di sini tinggal gate quiz (skema tak tahu tipe form) + hitung
                # keyed untuk poin. Pesan bernomor bagian/soal agar mudah dicari.
                if q.answer_key is not None and not is_quiz:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Bagian {si + 1} soal {qi + 1}: Answer key hanya tersedia untuk tipe quiz",
                    )
                keyed = bool((q.answer_key or "").strip())
                question = Question(
                    form_id=form.id,
                    type=QuestionType(q.type),
                    question_text=q.question_text,
                    points=(0 if (is_quiz or q.type in _NO_GRADE_TYPES or (q.type in ("essay", "short_answer") and not keyed)) else q.points),
                    is_scored=q.is_scored,
                    is_required=q.is_required,
                    section_id=section.id,
                    group_id=q.group_id,
                    password_keyword=q.password_keyword if q.type == "password" else None,
                    answer_key=q.answer_key if q.type in ("essay", "short_answer") else None,
                    allow_other=q.allow_other if q.type in ("multiple_choice", "checkbox") else False,
                    order_index=order,
                    created_at=now,
                )
                order += 1
                db.add(question)
                db.flush()
                for i, opt in enumerate(q.options):
                    db.add(QuestionOption(
                        question_id=question.id,
                        option_text=opt.option_text,
                        is_correct=opt.is_correct,
                        order_index=i,
                    ))
        distribute_quiz_points(form.id, db)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Gagal membuat form dari draf AI")
    return {"id": form.id, "message": "Form dari AI berhasil dibuat"}
