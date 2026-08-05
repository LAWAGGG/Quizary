import re
import io
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import verify_form_owner
from app.models.form import Form
from app.models.question import Question, QuestionType
from app.models.question_option import QuestionOption
from app.services.points import distribute_quiz_points
from app.utils import now_wib

router = APIRouter(tags=["import"])

WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

ANSWER_RE = re.compile(r'(?:Kunci\s*)?(?:Jawaban|Jawab|Answer)\s*[:\-]?\s*([A-Da-d])\b', re.IGNORECASE)
NUMBERED_RE = re.compile(r'\d+[\.\)]\s*(.+)')
OPTION_INLINE_RE = re.compile(r'(?:^|\s)([A-Da-d])[\.\)]\s*(.*?)(?=\s+[A-Da-d][\.\)]|$)')


# ============================================================
# Path 1: plain text paste ("POST /import/text") — tidak berubah,
# tetap dipakai untuk teks yang diketik manual (tidak ada info numbering Word)
# ============================================================
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
            m = NUMBERED_RE.match(line)
            if m:
                q_text = m.group(1).strip()
                continue
            m = ANSWER_RE.match(line)
            if m:
                answer_letter = m.group(1).upper()
                continue
            for om in OPTION_INLINE_RE.finditer(line):
                text = om.group(2).strip()
                if text:
                    options.append({"letter": om.group(1).upper(), "text": text})

        if q_text:
            questions.append({
                "question_text": q_text,
                "options": [
                    {"text": opt["text"], "is_correct": opt["letter"] == answer_letter}
                    for opt in options
                ],
            })

    return questions


# ============================================================
# Path 2: import .docx — DIPERBAIKI supaya bisa baca native Word
# numbered list (numPr), bukan cuma angka yang diketik manual
# ============================================================
def _extract_docx_items(doc) -> list[tuple[str, str | None]]:
    """
    Kembalikan list (text, num_id) per paragraf non-kosong.
    num_id None berarti paragraf itu TIDAK memakai numbering otomatis Word
    (baik karena memang teks biasa, maupun karena angkanya diketik manual —
    dua kasus ini tetap bisa dibedakan lewat regex NUMBERED_RE di caller).
    """
    items = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if not text:
            continue
        numPr = p._p.find(f".//{WORD_NS}numPr")
        num_id = None
        if numPr is not None:
            numId_el = numPr.find(f"{WORD_NS}numId")
            if numId_el is not None:
                num_id = numId_el.get(f"{WORD_NS}val")
        items.append((text, num_id))
    return items


def _parse_docx_items(items: list[tuple[str, str | None]]) -> list[dict]:
    if not items:
        return []

    # Cari numId yang paling sering muncul -> itu kemungkinan besar
    # list penomoran SOAL (karena berulang 1x per soal di sepanjang dokumen),
    # numId lain yang muncul lokal biasanya sub-list opsi jawaban.
    numid_counts = Counter(nid for _, nid in items if nid is not None)
    question_num_id = numid_counts.most_common(1)[0][0] if numid_counts else None

    questions: list[dict] = []
    current: dict | None = None
    active_option_num_id: str | None = None
    option_letters = iter("ABCDEFGHIJ")

    def flush():
        nonlocal current
        if current and current.get("question_text"):
            questions.append(current)
        current = None

    def start_question(text: str):
        nonlocal current, active_option_num_id, option_letters
        flush()
        current = {"question_text": text.strip(), "options": [], "answer_letter": None}
        active_option_num_id = None
        option_letters = iter("ABCDEFGHIJ")

    for text, num_id in items:
        # 1) angka diketik manual "1. ..." / "1) ..." (bisa juga muncul di dokumen
        #    yang campur: sebagian numbering manual, sebagian native Word list)
        m = NUMBERED_RE.match(text)
        if m and (num_id is None or num_id == question_num_id):
            start_question(m.group(1))
            continue

        # 2) baris "Jawaban: X"
        m = ANSWER_RE.match(text)
        if m and current is not None:
            current["answer_letter"] = m.group(1).upper()
            continue

        # 3) opsi manual "A. ..." (termasuk multi-kolom satu baris "A. x D. y")
        found_option = False
        if current is not None:
            for om in OPTION_INLINE_RE.finditer(text):
                opt_text = om.group(2).strip()
                if opt_text:
                    current["options"].append({"letter": om.group(1).upper(), "text": opt_text})
                    found_option = True
        if found_option:
            continue

        # 4) native Word numbered list, numId = numId soal (mayoritas) -> soal baru
        if num_id is not None and num_id == question_num_id:
            start_question(text)
            continue

        # 5) native Word numbered list, numId BEDA -> anggap sub-list opsi jawaban
        if num_id is not None and current is not None:
            if active_option_num_id != num_id:
                active_option_num_id = num_id
                option_letters = iter("ABCDEFGHIJ")
            letter = next(option_letters, "?")
            current["options"].append({"letter": letter, "text": text})
            continue

        # 6) tidak ada numbering & tidak match pola apapun -> baris lanjutan
        #    (soal/opsi yang wrap ke baris baru), gabungkan ke item terakhir
        if current is not None:
            if current["options"]:
                current["options"][-1]["text"] += " " + text
            else:
                current["question_text"] += " " + text
            continue

        # 7) belum ada soal terbuka (misal judul dokumen di baris pertama) -> lewati

    flush()

    # finalisasi is_correct
    result = []
    for q in questions:
        answer_letter = q.pop("answer_letter", None)
        result.append({
            "question_text": q["question_text"],
            "options": [
                {"text": o["text"], "is_correct": o["letter"] == answer_letter}
                for o in q["options"]
            ],
        })
    return result


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

    items = _extract_docx_items(doc)
    parsed = _parse_docx_items(items)

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
    now = now_wib()
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

    distribute_quiz_points(form.id, db)
    db.commit()
    return {"message": f"{count} question(s) imported successfully", "imported_count": count}


if __name__ == "__main__":
    import os
    from docx import Document  # type: ignore

    # fixture: plain text (manual numbering, essay + MCQ multi-column)
    s = """1. Tes essay saja apakah terbaca
2. Soal pilihan ganda tanpa kunci jawaban
A. 252 cara\t\tD. 258 cara
C. 256 cara
3. Opsi gambar/placeholder
A.
D.
"""
    qs = _parse_text(s)
    assert len(qs) == 3, qs
    assert qs[0]["options"] == [], "essay harus disimpan tanpa opsi"
    assert [o["text"] for o in qs[1]["options"]] == ["252 cara", "258 cara", "256 cara"]
    assert qs[2]["options"] == [], "opsi kosong harus dibuang"

    # fixture: docx dengan native Word numbering (numPr)
    sample = os.path.join(os.path.dirname(__file__), "../../../tmp_test/soal mtk.docx")
    if os.path.exists(sample):
        doc = Document(sample)
        parsed = _parse_docx_items(_extract_docx_items(doc))
        mc = [q for q in parsed if q["options"]]
        assert len(mc) >= 2, mc
        assert all(len(q["options"]) == 5 for q in mc), [len(q["options"]) for q in mc]
        assert any(len(q["options"]) == 0 for q in parsed), "harus ada essay (soal gambar/no.3)"
        print(f"ok docx; {len(parsed)} soal, {len(mc)} MCQ (masing-masing 5 opsi)")
    print("done")