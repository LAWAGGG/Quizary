import re
import io
import os
import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi import Form as ApiForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import verify_form_owner
from app.models.form import Form, ScoringMode
from app.models.image import Image
from app.models.question import Question, QuestionType, Section
from app.models.question_option import QuestionOption
from app.services.points import distribute_quiz_points
from app.utils import UPLOAD_DIR, MAX_DOCX_BYTES, now_wib, read_limited

router = APIRouter(tags=["import"])

WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Opsi jawaban tidak dibatasi A-D — bebas sampai A-J (10 opsi), konsisten
# dengan iterator "ABCDEFGHIJ" untuk native Word list di bawah. Huruf tunggal
# M+ (I/O/Q/X/Y/Z) rentan false-positive sebagai teks biasa, jadi batasi di J.
# Multi-huruf dipisah koma/space (mis. "Answer: A, C" / "Jawaban: A C") untuk checkbox.
ANSWER_RE = re.compile(r'(?:Kunci\s*)?(?:Jawaban|Jawab|Answer)\s*[:\-]?\s*([A-Ja-j](?:\s*[,;\s]\s*[A-Ja-j])*)\b', re.IGNORECASE)
# Kunci teks panjang untuk essay/short_answer: tangkap sisa baris setelah
# "Kunci:" / "Answer:" (multi-kunci pisah ";" — di-trim/di-truncate saat
# validasi lewat check_answer_key dari schemas.question).
ANSWER_TEXT_RE = re.compile(r'^\s*(?:Kunci|Answer)\s*[:\-]\s*(.+?)\s*$', re.IGNORECASE)
# Marker tipe lama tetap dikenali agar baris metadata pada dokumen lama tidak
# ikut masuk ke teks soal. Untuk DOCX, tipe ditentukan dari ada/tidaknya opsi:
# tanpa opsi = essay; dengan opsi = multiple_choice/checkbox.
TYPE_RE = re.compile(r'^\s*(?:Tipe|Type)\s*[:\-]\s*(essay|short[\s_]?answer|isian[\s_]?singkat|esai|isian)\s*$', re.IGNORECASE)
NUMBERED_RE = re.compile(r'\d+[\.\)]\s*(.+)')
OPTION_INLINE_RE = re.compile(r'(?:^|\s)([A-Ja-j])[\.\)]\s*(.*?)(?=\s+[A-Ja-j][\.\)]|$)')
# Kolom point per soal — posisi bebas dalam blok soal (atas/tengah/akhir).
# Varian: Point:/Poin:/Skor: + integer 1-100. Nilai di luar itu = tanpa point.
POINT_PREFIX_RE = re.compile(r'^\s*(?:Point|Poin|Skor)\s*[:\-]', re.IGNORECASE)
POINT_RE = re.compile(r'^\s*(?:Point|Poin|Skor)\s*[:\-]\s*(\d{1,3})\s*$', re.IGNORECASE)


def _parse_point_value(text: str) -> int | None:
    m = POINT_RE.match(text)
    if not m:
        return None
    v = int(m.group(1))
    return v if 1 <= v <= 100 else None


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
        answer_key: str | None = None
        forced_type: str | None = None
        points: int | None = None

        for line in block.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = NUMBERED_RE.match(line)
            if m:
                q_text = m.group(1).strip()
                continue
            # Kolom point posisi bebas — baris khusus, jangan jadi teks soal.
            # Nilai invalid (0, >100, non-angka) = dianggap tanpa point.
            if POINT_PREFIX_RE.match(line):
                v = _parse_point_value(line)
                if v is not None:
                    points = v
                continue
            m = TYPE_RE.match(line)
            if m:
                tag = m.group(1).lower().replace(' ', '_').replace('_', ' ').strip()
                # normalisasi: short answer / isian singkat → short_answer, esai/essay
                if tag in ('short_answer', 'short answer', 'isian_singkat', 'isian singkat', 'isian'):
                    forced_type = 'short_answer'
                else:
                    forced_type = 'essay'
                continue
            m = ANSWER_RE.match(line)
            if m:
                # Parse "A, C" / "A C" / "A;C" jadi set huruf
                letters = {x.upper() for x in re.findall(r'[A-Ja-j]', m.group(1))}
                answer_letter = letters
                continue
            m = ANSWER_TEXT_RE.match(line)
            if m:
                answer_key = m.group(1).strip()
                continue
            for om in OPTION_INLINE_RE.finditer(line):
                text = om.group(2).strip()
                if text:
                    options.append({"letter": om.group(1).upper(), "text": text})

        if q_text:
            # essay/short_answer eksplisit: abaikan opsi A./B. agar tidak jadi MC
            if forced_type in ('essay', 'short_answer'):
                options = []
                answer_letter = None
            questions.append({
                "question_text": q_text,
                "forced_type": forced_type,
                "options": [
                    {"text": opt["text"], "is_correct": (opt["letter"] in answer_letter) if isinstance(answer_letter, set) else (opt["letter"] == answer_letter)}
                    for opt in options
                ],
                "answer_key": answer_key,
                "points": points,
            })

    return questions


# ============================================================
# Path 2: import .docx — DIPERBAIKI supaya bisa baca native Word
# numbered list (numPr), bukan cuma angka yang diketik manual
# ============================================================
def _para_images(p) -> list[tuple[str, bytes]]:
    """Ambil semua gambar yang tertanam di dalam sebuah paragraf docx.

    Docx adalah file ZIP; gambar dirender lewat relasi rId pada elemen
    ``<a:blip r:embed="rIdN">``. Blob biner diambil langsung dari part —
    TANPA base64, sehingga ukuran file asli tidak membengkak 33%.
    """
    imgs: list[tuple[str, bytes]] = []
    for blip in p._p.findall(f".//{A_NS}blip"):
        rid = blip.get(f"{R_NS}embed")
        if not rid:
            continue
        rel = p.part.rels.get(rid)
        if rel is None or rel.is_external:
            continue
        part = rel.target_part
        ext = os.path.splitext(str(part.partname))[1].lower()
        if not ext:
            ext = ".png"
        imgs.append((ext, part.blob))
    return imgs


def _extract_docx_items(doc) -> list[tuple[str, str | None, list]]:
    """
    Kembalikan list (text, num_id, images) per paragraf yang punya makna.
    num_id None berarti paragraf itu TIDAK memakai numbering otomatis Word
    (baik karena memang teks biasa, maupun karena angkanya diketik manual —
    dua kasus ini tetap bisa dibedakan lewat regex NUMBERED_RE di caller).

    Paragraf text kosong TIDAK di-skip bila ia membawa numbering (nomor soal
    auto Word) atau gambar (stem soal berupa gambar) — keduanya krusial.

    Heading (Heading 1/2/3) di-skip karena itu cuma judul bagian, bukan soal.
    """
    items = []
    for p in doc.paragraphs:
        # Skip heading paragraphs (Heading 1/2/3) — they are section titles
        # in the document, not questions. The numbering inside headings is
        # already excluded.
        style_name = (p.style.name or "").lower() if p.style else ""
        if style_name.startswith("heading"):
            continue
        text = p.text.strip()
        numPr = p._p.find(f".//{WORD_NS}numPr")
        num_id = None
        if numPr is not None:
            numId_el = numPr.find(f"{WORD_NS}numId")
            if numId_el is not None:
                num_id = numId_el.get(f"{WORD_NS}val")
        imgs = _para_images(p)
        if not text and num_id is None and not imgs:
            continue
        items.append((text, num_id, imgs))
    return items


def _parse_docx_items(items: list[tuple[str, str | None, list]]) -> list[dict]:
    if not items:
        return []

    # Cari numId yang paling sering muncul -> itu kemungkinan besar
    # list penomoran SOAL (karena berulang 1x per soal di sepanjang dokumen),
    # numId lain yang muncul lokal biasanya sub-list opsi jawaban.
    numid_counts = Counter(nid for _, nid, _ in items if nid is not None)
    question_num_id = numid_counts.most_common(1)[0][0] if numid_counts else None

    questions: list[dict] = []
    current: dict | None = None
    active_option_num_id: str | None = None
    option_letters = iter("ABCDEFGHIJ")
    # Point di atas nomor soal (sebelum soal pertama / antar soal): tadah
    # sementara, ditempel ke soal berikutnya saat start_question.
    pending_points: int | None = None

    def flush():
        nonlocal current
        if current and (current["question_text"] or current["images"]):
            questions.append(current)
        current = None

    def attach_imgs(target: dict, imgs: list):
        for ext, blob in imgs:
            target["images"].append({"ext": ext, "blob": blob})

    def start_question(text: str, imgs: list):
        nonlocal current, active_option_num_id, option_letters, pending_points
        flush()
        current = {
            "question_text": text.strip(),
            "options": [],
            "answer_letter": None,
            "answer_key": None,
            "forced_type": None,
            "points": pending_points,
            "images": [],
        }
        pending_points = None
        active_option_num_id = None
        option_letters = iter("ABCDEFGHIJ")
        attach_imgs(current, imgs)

    for text, num_id, imgs in items:
        # 1) angka diketik manual "1. ..." / "1) ..." (bisa juga muncul di dokumen
        #    yang campur: sebagian numbering manual, sebagian native Word list)
        m = NUMBERED_RE.match(text)
        if m and (num_id is None or num_id == question_num_id):
            start_question(m.group(1), imgs)
            continue

        # 2) Marker tipe lama tidak lagi menentukan tipe pada import DOCX.
        #    Lewati barisnya, lalu biarkan opsi tetap diproses seperti biasa.
        m = TYPE_RE.match(text)
        if m and current is not None:
            continue

        # 3) baris "Jawaban: X" (huruf A-J, bisa multi "A, C") — untuk soal dengan opsi
        m = ANSWER_RE.match(text)
        if m and current is not None:
            letters = {x.upper() for x in re.findall(r'[A-Ja-j]', m.group(1))}
            current["answer_letter"] = letters
            continue

        # 4) baris "Kunci: ..." (teks panjang) atau "Answer: teks" untuk essay/short_answer
        m = ANSWER_TEXT_RE.match(text)
        if m and current is not None:
            current["answer_key"] = m.group(1).strip()
            continue

        # 4b) baris "Point: N" / "Poin: N" / "Skor: N" — posisi bebas dalam
        # blok soal (atas/tengah/akhir). Invalid (0, >100, non-angka) =
        # tanpa point, bukan teks soal. Sebelum soal pertama → pending,
        # ditempel ke soal berikutnya saat start_question.
        if POINT_PREFIX_RE.match(text):
            v = _parse_point_value(text)
            if v is not None:
                if current is not None:
                    current["points"] = v
                else:
                    pending_points = v
            continue

        # 5) opsi manual "A. ..." (termasuk multi-kolom satu baris "A. x D. y").
        #    Opsi tetap diproses; tipe akhir ditentukan saat persistence.
        found_option = False
        if current is not None:
            for om in OPTION_INLINE_RE.finditer(text):
                opt_text = om.group(2).strip()
                if opt_text:
                    opt = {"letter": om.group(1).upper(), "text": opt_text, "images": []}
                    attach_imgs(opt, imgs)
                    current["options"].append(opt)
                    found_option = True
        if found_option:
            continue

        # 6) native Word numbered list, numId = numId soal (mayoritas) -> soal baru.
        #    Paragraf bisa text kosong (nomor auto Word ada di paragraf terpisah).
        if num_id is not None and num_id == question_num_id:
            start_question(text, imgs)
            continue

        # 7) native Word numbered list, numId BEDA -> anggap sub-list opsi jawaban
        if num_id is not None and current is not None:
            if active_option_num_id != num_id:
                active_option_num_id = num_id
                option_letters = iter("ABCDEFGHIJ")
            letter = next(option_letters, "?")
            opt = {"letter": letter, "text": text, "images": []}
            attach_imgs(opt, imgs)
            current["options"].append(opt)
            continue

        # 8) tidak ada numbering & tidak match pola apapun -> baris lanjutan
        #    (soal/opsi yang wrap ke baris baru, atau stem soal berupa gambar),
        #    gabungkan ke item terakhir
        if current is not None:
            if current["options"]:
                last_opt = current["options"][-1]
                if text:
                    last_opt["text"] += " " + text
                attach_imgs(last_opt, imgs)
            else:
                if text:
                    current["question_text"] += " " + text
                attach_imgs(current, imgs)
            continue

        # 9) belum ada soal terbuka (misal judul dokumen di baris pertama) -> lewati

    flush()

    # finalisasi is_correct + pastikan struktur konsisten
    result = []
    for q in questions:
        answer_letter = q.pop("answer_letter", None)
        answer_key = q.pop("answer_key", None)
        forced_type = q.pop("forced_type", None)
        points = q.pop("points", None)
        result.append({
            "question_text": q["question_text"],
            "images": q["images"],
            "forced_type": forced_type,
            "options": [
                {
                    "text": o["text"],
                    "is_correct": (o["letter"] in answer_letter) if isinstance(answer_letter, set) else (o["letter"] == answer_letter),
                    "images": o["images"],
                }
                for o in q["options"]
            ],
            "answer_key": answer_key,
            "points": points,
        })
    return result


_WEB_IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _sanitize_answer_key(raw: str | None) -> str | None:
    """Sanitasi kunci jawaban dari import Word/Docx.

    - Kosong / whitespace → None (soal dianggap tanpa kunci, is_scored=False)
    - Trim + potong per kunci (maks MAX_KEYWORD_LEN=100 char) sesuai schema
    - Drop kunci kosong (mis. ";; jakarta;;") agar parse_answer_key tidak dapat list berlubang
    - Drop kunci setelah MAX_KEYWORDS=10 agar sesuai schema
    - Hasil digabung kembali dengan pemisah ";" — input boleh pakai ";" atau "\n"
    """
    if not raw:
        return None
    from app.schemas.question import MAX_KEYWORD_LEN, MAX_KEYWORDS
    parts = re.split(r"[;\n]+", raw)
    cleaned: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(p) > MAX_KEYWORD_LEN:
            p = p[:MAX_KEYWORD_LEN].rstrip()
        if p:
            cleaned.append(p)
        if len(cleaned) >= MAX_KEYWORDS:
            break
    if not cleaned:
        return None
    return ";".join(cleaned)


def _save_blob(ext: str, blob: bytes) -> str:
    """Tulis blob biner docx ke disk uploads, kembalikan path relatif.

    Hanya format web (dapat dirender <img>) yang disimpan; format vektor
    docx seperti .emf/.wmf di-skip — tidak bisa dirender browser.
    """
    if ext not in _WEB_IMG_EXT:
        return ""
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, "question-images", filename)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(blob)
    return f"question-images/{filename}"


@router.post("/forms/{form_id}/import/docx", status_code=201)
def import_docx(
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    section_id: int | None = ApiForm(None),
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

    # Ensure at least one section exists — auto-create "Default" if needed.
    sections = db.query(Section).filter(Section.form_id == form.id).all()
    if not sections:
        auto = Section(form_id=form.id, title="Default", order_index=0, created_at=now_wib())
        db.add(auto)
        db.flush()
        sections = [auto]
    if len(sections) > 1 and not section_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pilih section tujuan terlebih dahulu",
        )
    if section_id:
        if not any(s.id == section_id for s in sections):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Section tidak ditemukan pada form ini",
            )
        target_section_id = section_id
    else:
        target_section_id = sections[0].id

    content = read_limited(file.file, MAX_DOCX_BYTES)
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
        .filter(Question.form_id == form.id, Question.is_deleted.is_(False))
        .order_by(Question.order_index.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    now = now_wib()
    count = 0

    # Kolom "Point: N" per soal (quiz saja): ada satu saja point valid →
    # form pindah ke manual, point mengikuti angka import. Soal tanpa point
    # valid (termasuk essay berpoint tapi tanpa kunci) → is_scored=False,
    # points=0. Tanpa point sama sekali → perilaku lama (auto pool 100).
    is_quiz = form.type.value == "quiz"
    has_manual_points = is_quiz and any(
        isinstance(q_data.get("points"), int) and 1 <= q_data["points"] <= 100
        for q_data in parsed
    )
    if has_manual_points:
        form.scoring_mode = ScoringMode.manual

    for q_data in parsed:
        has_options = bool(q_data["options"])
        correct_count = sum(1 for o in q_data["options"] if o["is_correct"])

        # Soal dengan opsi tetap menjadi pilihan ganda/checkbox. Hanya soal
        # tanpa opsi yang otomatis menjadi essay.
        if has_options and correct_count > 1:
            q_type = QuestionType.checkbox
        elif has_options:
            q_type = QuestionType.multiple_choice
        else:
            q_type = QuestionType.essay

        # Sanitasi answer_key dari parser — multi-kunci pisah ";" (sesuai schema).
        # ISOLASI form: form tidak simpan answer_key sama sekali (never scored).
        raw_key = q_data.get("answer_key")
        answer_key = None
        if form.type.value == "quiz" and q_type in (QuestionType.essay, QuestionType.short_answer):
            answer_key = _sanitize_answer_key(raw_key)

        # Tipe tanpa opsi (essay/short tanpa key, date, time, file_upload) → no-grade.
        # Essay/short_answer dengan key valid → is_scored=True (auto-graded).
        _has_keyword_grade = (
            q_type in (QuestionType.essay, QuestionType.short_answer)
            and bool(answer_key)
        )
        _no_grade = q_type in (
            QuestionType.date, QuestionType.time, QuestionType.file_upload
        ) or (q_type in (QuestionType.essay, QuestionType.short_answer) and not _has_keyword_grade)

        # Point import (quiz manual): angka valid 1-100 dipakai apa adanya,
        # KECUALI essay berpoint tapi tanpa kunci → is_scored=False, points=0.
        # Soal tanpa point valid dalam batch manual → is_scored=False, points=0.
        _import_points = q_data.get("points")
        _valid_import_points = (
            has_manual_points
            and isinstance(_import_points, int)
            and 1 <= _import_points <= 100
        )
        if has_manual_points:
            _no_grade = True if not _valid_import_points else _no_grade
            if _valid_import_points and q_type in (QuestionType.essay, QuestionType.short_answer) and not _has_keyword_grade:
                _no_grade = True

        if has_manual_points:
            _points = _import_points if (_valid_import_points and not _no_grade) else 0
        else:
            # Auto mode pool 100 → poin 0 dulu, distribute_quiz_points di akhir
            # yang mengisi; manual mode pakai default 1.
            # Essay/short tanpa key / tipe non-graded → selalu 0 (tidak ikut pool).
            _points = (
                0
                if form.type.value == "quiz"
                or q_type in (QuestionType.date, QuestionType.time, QuestionType.file_upload)
                or (q_type in (QuestionType.essay, QuestionType.short_answer) and not _has_keyword_grade)
                else 1
            )

        q = Question(
            form_id=form.id,
            type=q_type,
            question_text=q_data["question_text"],
            points=_points,
            is_scored=not _no_grade,
            section_id=target_section_id,
            order_index=next_order,
            answer_key=answer_key,
            created_at=now,
        )
        db.add(q)
        db.flush()

        for i, img in enumerate(q_data["images"]):
            path = _save_blob(img["ext"], img["blob"])
            if path:
                db.add(Image(
                    question_id=q.id,
                    path=path,
                    order_index=i,
                    created_at=now,
                ))

        opt_rows = []
        for i, opt in enumerate(q_data["options"]):
            opt_rows.append(QuestionOption(
                question_id=q.id,
                option_text=opt["text"],
                is_correct=opt["is_correct"],
                order_index=i,
            ))
            db.add(opt_rows[-1])
        db.flush()

        for opt_row, opt in zip(opt_rows, q_data["options"]):
            for j, img in enumerate(opt["images"]):
                path = _save_blob(img["ext"], img["blob"])
                if path:
                    db.add(Image(
                        option_id=opt_row.id,
                        path=path,
                        order_index=j,
                        created_at=now,
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
4. Soal 5 opsi satu baris dengan kunci E
Jawaban: E
A. satu B. dua C. tiga D. empat E. lima
"""
    qs = _parse_text(s)
    assert len(qs) == 4, qs
    assert qs[0]["options"] == [], "essay harus disimpan tanpa opsi"
    assert [o["text"] for o in qs[1]["options"]] == ["252 cara", "258 cara", "256 cara"]
    assert qs[2]["options"] == [], "opsi kosong harus dibuang"
    five = qs[3]
    assert [o["text"] for o in five["options"]] == ["satu", "dua", "tiga", "empat", "lima"], "opsi E harusnya tidak tertimbun"
    assert [o["is_correct"] for o in five["options"]] == [False, False, False, False, True], "kunci E harus dikenali"

    # fixture: checkbox dengan multi-huruf "Answer: A, C" — harus tangkap A dan C benar
    cb = """1. Bilangan prima
A. 2
B. 4
C. 7
D. 9
Answer: A, C
"""
    qs_cb = _parse_text(cb)
    assert len(qs_cb) == 1
    assert sum(1 for o in qs_cb[0]["options"] if o["is_correct"]) == 2
    correct_texts = sorted(o["text"] for o in qs_cb[0]["options"] if o["is_correct"])
    assert correct_texts == ["2", "7"], correct_texts

    # fixture: essay + kunci multi-key pisah ";" (sintaks import Word)
    s2 = """1. Jelaskan proses fotosintesis.
Kunci: fotosintesis; tumbuhan; cahaya matahari
2. Apa ibu kota Indonesia?
Tipe: short answer
Kunci: Jakarta
3. Soal Tipe: essay dengan opsi A./B. (opsi harus di-drop)
Tipe: essay
A. pilihan 1
B. pilihan 2
4. Multi-kunci dengan kunci panjang
Kunci: ibu kota; DKI Jakarta; Special Capital Region
"""
    qs2 = _parse_text(s2)
    assert len(qs2) == 4, qs2
    # essay + multi-kunci
    assert qs2[0]["options"] == [], "essay #1 tidak boleh punya opsi"
    assert qs2[0]["answer_key"] == "fotosintesis; tumbuhan; cahaya matahari", qs2[0]["answer_key"]
    assert qs2[0]["forced_type"] is None, "no marker → forced_type None (heuristic)"
    # short answer eksplisit
    assert qs2[1]["forced_type"] == "short_answer", qs2[1]["forced_type"]
    assert qs2[1]["options"] == [], "short_answer #2 tidak boleh punya opsi"
    assert qs2[1]["answer_key"] == "Jakarta", qs2[1]["answer_key"]
    # Tipe essay + opsi harus drop opsi
    assert qs2[2]["forced_type"] == "essay", qs2[2]["forced_type"]
    assert qs2[2]["options"] == [], "essay eksplisit harus drop opsi"
    # multi-kunci 3 entri
    assert qs2[3]["answer_key"] == "ibu kota; DKI Jakarta; Special Capital Region", qs2[3]["answer_key"]

    # fixture: sanitizer untuk kunci panjang
    long_key = "x" * 150
    multi_overflow = ";".join([f"k{i}" for i in range(15)])
    sanitized = _sanitize_answer_key(long_key)
    assert sanitized is not None and len(sanitized) == 100, f"kunci panjang harus dipotong ke 100: {len(sanitized or '')}"
    sanitized2 = _sanitize_answer_key(multi_overflow)
    assert sanitized2 is not None and sanitized2.count(";") == 9, f"multi-kunci >10 harus dipotong ke 10 entri: {sanitized2}"
    # whitespace + pemisah campur
    sanitized3 = _sanitize_answer_key("  jakarta ;;\nDKI Jakarta  \n; ")
    assert sanitized3 == "jakarta;DKI Jakarta", sanitized3
    # kosong / None
    assert _sanitize_answer_key(None) is None
    assert _sanitize_answer_key("   ") is None
    print("ok essay/short_answer + Kunci parser + sanitizer")

    # fixture: kolom Point:/Poin:/Skor: posisi bebas (atas/tengah/akhir),
    # 1-100 bulat valid; 0/>100/desimal/non-angka = tanpa point.
    assert _parse_point_value("Point: 10") == 10
    assert _parse_point_value("Poin: 20") == 20
    assert _parse_point_value("Skor: 5") == 5
    assert _parse_point_value("Point: 0") is None
    assert _parse_point_value("Point: 101") is None
    assert _parse_point_value("Point: 2.5") is None
    assert _parse_point_value("Point: abc") is None
    s3 = """1. Soal MC point di atas
Point: 10
A. x
B. y
Answer: B
2. Soal MC point di tengah
A. x
B. y
Poin: 20
Answer: A
3. Soal MC point di akhir
A. x
B. y
Answer: A
Skor: 30
4. Soal tanpa point
A. x
B. y
Answer: B
5. Essay berpoint tanpa kunci
Point: 15
6. Essay berpoint berkunci
Point: 25
Kunci: jakarta
7. Soal nilai nol
Point: 0
A. x
B. y
Answer: A
"""
    qs3 = _parse_text(s3)
    assert [q["points"] for q in qs3] == [10, 20, 30, None, 15, 25, None], [q["points"] for q in qs3]
    assert all(
        "Point:" not in q["question_text"] and "Poin:" not in q["question_text"] and "Skor:" not in q["question_text"]
        for q in qs3
    ), "point bocor ke teks soal"
    print("ok Point:/Poin:/Skor: posisi bebas + invalid ditolak")

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

    # fixture nyata: stem soal berupa gambar, nomor soal auto-numbering di
    # paragraf kosong, opsi teks tanpa numbering -> 20 soal MCQ, 20 gambar stem
    real = os.path.join(os.path.dirname(__file__), "../../../ULANGAN HARIAN BAHASA INDONESIA.docx")
    if os.path.exists(real):
        doc = Document(real)
        parsed = _parse_docx_items(_extract_docx_items(doc))
        assert len(parsed) == 20, f"harus 20 soal, dapat {len(parsed)}"
        assert all(len(q["images"]) == 1 for q in parsed), "tiap soal harus punya 1 gambar stem"
        assert all(q["images"][0]["ext"] == ".png" for q in parsed), "stem harus PNG"
        assert all(3 <= len(q["options"]) <= 5 for q in parsed), "opsi 3-5 per soal"
        assert all(o["text"] for q in parsed for o in q["options"]), "ada opsi kosong"
        print(f"ok real docx; {len(parsed)} soal, 20 gambar stem PNG, opsi 3-5 per soal")
    print("done")
