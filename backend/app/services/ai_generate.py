"""Generate draf form (sections + soal + settings) via Gemini.

Alur: prompt + file referensi (teks) -> Gemini (JSON mode) -> draf yang
sudah disanitasi. Draf TIDAK langsung jadi form — creator mereview lalu
POST /api/ai/accept yang memvalidasi ulang memakai skema existing.
"""
import copy
import html
import io
import json
import logging
import re
import time

import httpx

from app.config import GEMINI_FALLBACK_MODEL, GEMINI_MODEL
from app.schemas.question import QuestionCreate

logger = logging.getLogger("quizary.ai")

ALLOWED_REF_EXT = {".docx", ".pdf", ".ppt", ".pptx"}
MAX_REF_FILES = 5
MAX_REF_FILE_BYTES = 5 * 1024 * 1024  # 5 MB per file
MAX_REF_TOTAL_CHARS = 30_000

MAX_SECTIONS = 10
MAX_QUESTIONS = 50
MAX_OPTIONS = 10


def truncate_refs(refs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Potong proporsional per file bila total melebihi MAX_REF_TOTAL_CHARS.

    Murni fungsi data (tanpa HTTP) supaya service mandiri dan mudah diuji;
    router tinggal panggil setelah teks referensi terkumpul.
    """
    if not refs:
        return refs
    total = sum(len(t) for _, t in refs)
    if total <= MAX_REF_TOTAL_CHARS:
        return refs
    budget = MAX_REF_TOTAL_CHARS // len(refs)
    return [(n, t[:budget]) for n, t in refs]

# Timeout per percobaan Gemini. Worst-case dijaga ~2 mnt (2 model x 1 coba x
# 60 dtk) agar muat di proxy_read_timeout nginx (300 dtk) dan timeout
# frontend 180 dtk.
GEMINI_TIMEOUT = 60.0

QUESTION_TYPES = (
    "multiple_choice", "checkbox", "dropdown", "short_answer", "essay",
    "password", "date", "time", "datetime", "file_upload",
)
OPTION_TYPES = ("multiple_choice", "checkbox", "dropdown")
# quiz multiple_choice wajib tepat 1 kunci — dicek ulang saat accept.


class AiNotConfigured(Exception):
    pass


class AiFailed(Exception):
    pass


def _scan_ppt_records(data: bytes) -> list[str]:
    """Scan record PowerPoint: TextCharsAtom (0x0FA0, UTF-16LE) dan
    TextBytesAtom (0x0FA1/0x0FA8, single-byte). Container (ver 0xF) direkursi."""
    parts: list[str] = []

    def _scan(buf: bytes) -> None:
        off = 0
        n = len(buf)
        while off + 8 <= n:
            ver = buf[off] & 0x0F
            rtype = int.from_bytes(buf[off + 2:off + 4], "little")
            rlen = int.from_bytes(buf[off + 4:off + 8], "little")
            start = off + 8
            end = start + rlen
            if rlen < 0 or end > n:
                break
            payload = buf[start:end]
            if ver == 0x0F:
                _scan(payload)
            elif rtype == 0x0FA0:
                try:
                    t = payload.decode("utf-16-le").strip()
                except Exception:
                    t = ""
                if t:
                    parts.append(t)
            elif rtype in (0x0FA1, 0x0FA8):
                try:
                    t = payload.decode("cp1252").strip()
                except Exception:
                    t = ""
                if t:
                    parts.append(t)
            off = end

    _scan(data)
    return parts


def _extract_ppt_text(raw: bytes) -> str:
    """Ambil teks dari .ppt biner lama (OLE) tanpa LibreOffice.

    OLE valid tanpa stream teks (image-only) -> string kosong (router ubah
    jadi 422 "kosong atau tidak ada teksnya"). Bukan OLE / stream rusak ->
    raise (olefile) dan router ubah jadi 422 "tidak bisa dibaca".
    """
    import olefile  # type: ignore

    with olefile.OleFileIO(io.BytesIO(raw)) as ole:
        target = None
        for entry in ole.listdir():
            if len(entry) == 1 and entry[0].lower() == "powerpoint document":
                target = "/".join(entry)
                break
        if target is None:
            return ""
        data = ole.openstream(target).read()

    parts = _scan_ppt_records(data)
    seen: set[str] = set()
    uniq = [p for p in parts if p.strip() and not (p in seen or seen.add(p))]
    return "\n".join(uniq)


def extract_ref_text(filename: str, raw: bytes) -> str:
    """Ambil teks dari file referensi (docx/pdf/ppt/pptx)."""
    name = (filename or "").lower()
    if name.endswith(".docx"):
        from docx import Document  # type: ignore

        doc = Document(io.BytesIO(raw))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(c.text.strip() for c in row.cells if c.text.strip()))
        return "\n".join(parts)
    if name.endswith(".pdf"):
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(raw))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    if name.endswith(".pptx"):
        from pptx import Presentation  # type: ignore

        prs = Presentation(io.BytesIO(raw))
        parts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        t = "".join(run.text for run in para.runs).strip()
                        if t:
                            parts.append(t)
                if shape.has_table:
                    for row in shape.table.rows:
                        parts.append(" | ".join(c.text.strip() for c in row.cells if c.text.strip()))
        return "\n".join(parts)
    if name.endswith(".ppt"):
        return _extract_ppt_text(raw)
    raise AiFailed(f"Tipe file tidak didukung ({filename}). Pakai docx, pdf, ppt, atau pptx.")

_EXAMPLE_DRAFT = {
    "title": "judul form/kuis",
    "description": "deskripsi singkat (atau null)",
    "type": "form atau quiz",
    "sections": [
        {
            "title": "nama section",
            "questions": [
                {
                    "type": "__QUESTION_TYPES__",
                    "question_text": "teks soal",
                    "is_required": True,
                    "points": 1,
                    "group_id": None,
                    "options": [{"option_text": "teks opsi", "is_correct": True}],
                    "password_keyword": None,
                    "answer_key": None,
                    "allow_other": False,
                }
            ],
        }
    ],
    "settings": {
        "shuffle_questions": False,
        "shuffle_options": False,
        "timer_minutes": None,
        "require_login": False,
        "submission_limit": "unlimited",
        "show_leaderboard": False,
        "is_restricted": False,
        "show_in_history": True,
        "reveal_score": True,
        "reveal_answers": True,
        "starts_at": None,
        "ends_at": None,
    },
}

_EXAMPLE_JSON = json.dumps(_EXAMPLE_DRAFT).replace(
    '"__QUESTION_TYPES__"', '"salah satu: %s"' % (", ".join(QUESTION_TYPES))
)

SYSTEM_INSTRUCTION = """Kamu penyusun form/kuis untuk berbagai bahasa. Jawab HANYA dengan SATU objek JSON valid, tanpa markdown, tanpa penjelasan.

Bentuk:
%s

Meta WAJIB di root JSON:
- "title": judul form/kuis (teks polos, maks 150 karakter, dari inti permintaan).
- "description": deskripsi 1-2 kalimat (atau null bila tak perlu).
- "type": "quiz" bila permintaan menyebut kuis/ujian/ulangan/nilai/kunci jawaban/timer, selain itu "form".

Aturan WAJIB (B-light: tanpa group/wacana):
- SETIAP soal WAJIB standalone & mandiri — tidak bergantung soal lain. DILARANG pakai group_id (selalu null), DILARANG pakai delimiter "---" atau "--", DILARANG buat wacana/passage bersama untuk banyak soal. Jika prompt minta cerita, buat tiap soal lengkap sendiri tanpa mengulang cerita yang sama di soal lain.
- Contoh SALAH (jangan ditiru): "Saat sidang BPUPKI ... --- Pada tanggal 18 Agustus ..." (2 topik beda disambung ---, cerita tidak nyambung dengan pertanyaan). Contoh BENAR: 2 soal terpisah lengkap tanpa ---, masing-masing pertanyaan jelas.
- Kualitas: question_text ringkas, jelas, langsung ke inti, hindari pengulangan frasa. Untuk HOTS/story: pastikan cerita/stimulus RELEVAN langsung dengan pertanyaan yang mengikutinya. Jangan karang fakta sejarah/tanggal/nama jika tidak yakin — pakai fakta dari file referensi jika ada, atau buat soal konseptual tanpa tanggal spesifik. Jangan halusinasi.
- JSON vs fence: kamu menulis SATU objek JSON valid — TAPI isi field question_text/option_text WAJIB memakai konvensi fence ``` untuk kode (JSON hanya pembungkus, bukan alasan menulis kode sebaris). Newline di dalam string JSON ditulis \n biasa; fence pembuka/penutup TETAP ditulis ``` apa adanya.
- options HANYA untuk multiple_choice/checkbox/dropdown (2-4 opsi); tipe lain: options [] dan password_keyword null.
- password_keyword HANYA untuk type password (isi kata sandinya), selain itu null.
- answer_key SELALU null — JANGAN mengarang kunci jawaban (creator mengisinya saat review; kunci salah = penilaian otomatis salah).
- allow_other HANYA true bila user EKSPILISIT meminta opsi "lainnya"/"other"/ketik-sendiri, dan HANYA untuk multiple_choice/checkbox; selain itu false.
- Quiz: multiple_choice WAJIB tepat 1 option is_correct=true; checkbox boleh >1; timer_minutes WAJIB angka 1-1440.
- Bukan quiz: timer_minutes null, is_correct semua false, show_leaderboard false, scoring_mode auto.
- submission_limit: "unlimited" atau "once" (once = wajib login, auto-coerce).
- starts_at/ends_at: ISO "YYYY-MM-DDTHH:MM:SS" atau null; starts_at harus sebelum ends_at.
- question_text/option_text = teks polos, TANPA tag HTML (HTML mentah tampil sebagai teks, bukan render).
- Rumus/simbol: tulis LaTeX dengan delimiter \\(...\\) inline atau \\[...\\] display. JANGAN art Unicode (√½) dan JANGAN ejaan kata ("akar kuadrat dari").
- Kode: fence ```bahasa ... ``` (satu blok per snippet; bahasa: python, javascript, typescript, java, php, sql, cpp, html, css, json — framework dipetakan: Laravel->php, React/Vue->javascript). Kode inline: `satu backtick` untuk nama fungsi/variabel sebaris SAJA.
- Format soal kode: SEMUA kode WAJIB dalam SATU fence per soal — gabung semua baris kode dalam satu blok (JANGAN satu fence per baris, JANGAN ditempel sebaris dalam kalimat). Bahasa ditulis SEKALI di pembuka fence, JANGAN diulang di tiap baris kode. Contoh BENAR: "Perhatikan kode berikut:\n```javascript\nconst a = useState(0);\nconst b = () => setA(1);\n```\nMengapa...?". Contoh SALAH: "```javascript\nconst a = 1;\n```\n```javascript\nconst b = 2;\n```" (dua blok terpisah) atau "javascript const a = 1;\njavascript const b = 2;" (nama bahasa di tiap baris).
- Prioritas kode vs rumus: bila permintaan menyebut kode/program/koding (atau nama bahasa: python, javascript, java, sql, cpp, html), SEMUA potongan kode WAJIB pakai fence — JANGAN tulis kode dengan delimiter LaTeX \\(...\\) / \\[...\\]. LaTeX HANYA untuk rumus matematika asli, bukan untuk kode.
- Link: [teks](https://...) — hanya http(s); jangan link lain.
- Maksimal 10 sections, total maksimal 40 soal. Hemat token: jangan ulang teks yang sama di banyak soal, tiap soal beda.
""" % _EXAMPLE_JSON


IGNORED_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("banner", ("banner", "cover", "gambar header", "header image")),
    ("kategori", ("kategori", "category", "kelompok form")),
)

# Bahasa fence yang didukung konverter (lihat _LANG_OK_RE). Tanpa "c"/"go"
# satu-suku-kata — terlalu ambigu ("[C::class", "let's go").
_CODE_LANGS = (
    "python", "javascript", "typescript", "java", "php", "sql",
    "cpp", "c++", "c#", "html", "css", "json", "rust", "kotlin",
)
# Pola sintaks khas -> bahasa (dipakai saat teks soal tak menyebut nama
# bahasa, mis. AI tulis "Route::get(..)" tanpa kata "laravel"/"php").
_CODE_SMELL_LANGS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("php", ("::", "->")),
    ("javascript", ("=>", "useState", "useEffect", "console.", "jsx", "tsx",
                    "<h1", "<h2", "<div", "<p", "<span", "const ", "let ")),
    ("sql", ("SELECT", "FROM", "WHERE")),
    ("python", ("def ", "print(", "import ", "elif", "except")),
)


def _sniff_code_lang(text: str | None, preferred: str | list[str] | None = None) -> str | None:
    """Tebak bahasa dari sintaks khas di teks soal. Skor per bahasa dari jumlah
    penanda cocok; SQL butuh 2+ penanda (FROM/WHERE umum di prosa). Seri
    dipecah via preferred (intent prompt), lalu urutan peta."""
    t = f" {(text or '')} "
    tl = t.lower()
    scores: dict[str, int] = {}
    for lang, markers in _CODE_SMELL_LANGS:
        s = 0
        for mk in markers:
            if not mk:
                continue
            if mk[0].isalpha():
                if re.search(r"(?<![a-z0-9_])" + re.escape(mk.lower()), tl):
                    s += 1
            elif mk in t:
                s += 1
        if lang == "sql" and s < 2:
            s = 0
        if s:
            scores[lang] = s
    if not scores:
        return None
    best = max(scores.values())
    winners = [lang for lang, s in scores.items() if s == best]
    if len(winners) == 1:
        return winners[0]
    order = preferred if isinstance(preferred, list) else ([preferred] if preferred else [])
    for lang in order:
        if lang in winners:
            return lang
    return winners[0]
# Framework/library -> bahasa fence. Cek peta ini DULU sebelum bahasa umum
# (mis. "react" harus jadi javascript, bukan lolos tanpa bahasa).
_CODE_FRAMEWORK_MAP = {
    "laravel": "php", "codeigniter": "php", "symfony": "php",
    "react": "javascript", "vue": "javascript", "angular": "typescript",
    "nextjs": "javascript", "next.js": "javascript", "nuxt": "javascript",
    "express": "javascript", "nodejs": "javascript", "node.js": "javascript",
    "django": "python", "flask": "python", "fastapi": "python",
    "spring": "java", "tailwind": "css", "jsx": "javascript",
    "tsx": "typescript", "blade": "php", "eloquent": "php",
}
# Keyword umum bermakna soal kode/program. Sengaja tanpa "fungsi"/"variabel"/
# "method" — terlalu ambigu dengan soal matematika ("fungsi kuadrat").
# "soal"/"analisa"/"analisis" disengaja absen: terlalu umum, bukan sinyal kode.
_CODE_HINTS = (
    "kode", "koding", "coding", "program", "source code", "sourcecode",
    "script", "snippet", "output", "error", "exception", "debug",
    "loop", "sintaks", "syntax", "algoritma", "algorithm",
    "baris kode", "baris program", "analisa kode", "analisis kode",
    "code review", "trace", "tracing",
)


def _word_hit(t: str, kw: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9+#_.-]){re.escape(kw)}(?![a-z0-9+#_-])", t))


def _parse_requested_count(text: str | None) -> int | None:
    """Ambil jumlah soal yang diminta user ('30 soal', '10 pertanyaan').

    Ambil angka terbesar yang diikuti kata soal/pertanyaan/question,
    clamp 1-50 (sinkron MAX_QUESTIONS). None bila tak disebut eksplisit.
    """
    if not text:
        return None
    nums = [
        int(m.group(1))
        for m in re.finditer(
            r"(\d{1,3})\s*(soal|pertanyaan|questions?)",
            text,
            re.IGNORECASE,
        )
    ]
    if not nums:
        return None
    return max(1, min(MAX_QUESTIONS, max(nums)))


def _output_budget(user_text: str | None, base_total: int | None = None) -> int:
    """Budget maxOutputTokens dinamis: hemat untuk request kecil, cukup untuk
    soal kode multiline. Per soal kode ~450 token, non-kode ~300.

    base_total = jumlah soal akhir yang diharapkan (mis. edit-tambah:
    soal lama + N baru) — budget dihitung dari total itu agar output muat
    dan tak terpotong di tengah. Tetap cap 16384."""
    n = _parse_requested_count(user_text) or 10
    if base_total:
        n = max(n, base_total)
    per_q = 450 if detect_code_intent(user_text) is not None else 300
    raw = 800 + n * per_q
    stepped = ((raw + 1023) // 1024) * 1024
    return max(4096, min(16384, stepped))


_APPEND_RE = re.compile(r"(tambah(?:kan|lah)?|nambah|append|\badd\b)", re.IGNORECASE)
_APPEND_COUNT_RE = re.compile(
    r"(?:tambah(?:kan|lah)?|nambah|append|\badd\b)\s*(\d{1,3})",
    re.IGNORECASE,
)


def is_append_instruction(text: str | None) -> bool:
    """True bila instruksi minta MENAMBAH soal (ID/EN)."""
    return bool(_APPEND_RE.search(text or ""))


def parse_requested_add(text: str | None) -> int | None:
    """Ambil N dari instruksi tambah ('tambah 20 soal', 'add 5 questions').

    Clamp 1-50 (sinkron MAX_QUESTIONS). None bila tak disebut eksplisit.
    Beda dari _parse_requested_count: hanya hitung angka setelah kata tambah.
    """
    if not text:
        return None
    nums = [int(m.group(1)) for m in _APPEND_COUNT_RE.finditer(text)]
    if not nums:
        return None
    return max(1, min(MAX_QUESTIONS, max(nums)))


def count_draft_questions(draft: dict | None) -> int:
    """Hitung total soal dalam draf (sections -> questions)."""
    if not isinstance(draft, dict):
        return 0
    total = 0
    for s in (draft.get("sections") or []):
        if isinstance(s, dict):
            qs = s.get("questions") or []
            total += sum(1 for q in qs if isinstance(q, dict))
    return total


def _question_key(q: dict) -> str:
    """Kunci dedup soal: teks tanpa tag, rapatkan spasi, lowercase."""
    t = str((q or {}).get("question_text") or "") if isinstance(q, dict) else ""
    t = re.sub(r"<[^>]*>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t).strip().lower()


def merge_append_draft(old_draft: dict, new_draft: dict, instruction: str | None) -> dict:
    """Gabung hasil edit-tambah: soal lama utuh + soal benar-benar baru.

    Bila instruksi bukan tambah -> kembalikan new_draft apa adanya.
    Bila hasil tak lebih banyak dari draf awal (susut/terpotong) -> raise
    AiFailed agar router 502 dan draf lama di client tidak tertimpa.
    Soal lama dipakai verbatim dari old_draft (bukan teks returned LLM)
    agar rephrase/duplikat tak merusak data yang sudah benar.
    """
    if not is_append_instruction(instruction):
        return new_draft
    old_n = count_draft_questions(old_draft)
    new_n = count_draft_questions(new_draft)
    if new_n <= old_n:
        raise AiFailed(
            f"AI mengembalikan {new_n} soal dari {old_n} soal awal "
            "(output terpotong, draf lama tidak diubah). "
            "Minta tambah batch kecil (5-10 soal) lalu generate ulang."
        )
    old_keys = set()
    for s in ((old_draft or {}).get("sections") or []):
        if isinstance(s, dict):
            for q in (s.get("questions") or []):
                if isinstance(q, dict):
                    old_keys.add(_question_key(q))
    fresh: list[dict] = []
    for s in ((new_draft or {}).get("sections") or []):
        if isinstance(s, dict):
            for q in (s.get("questions") or []):
                if isinstance(q, dict) and _question_key(q) not in old_keys:
                    fresh.append(copy.deepcopy(q))
    if not fresh:
        raise AiFailed(
            f"AI tidak menambah soal baru (tetap {old_n} soal, draf lama "
            "tidak diubah). Coba instruksi lebih spesifik lalu generate ulang."
        )
    room = MAX_QUESTIONS - old_n
    if room <= 0:
        raise AiFailed(
            f"Draf sudah {old_n} soal (maksimal {MAX_QUESTIONS}). "
            "Hapus sebagian soal dulu sebelum menambah."
        )
    fresh = fresh[:room]
    merged = copy.deepcopy(old_draft)
    merged_secs = merged.get("sections") or []
    last = merged_secs[-1]
    last.setdefault("questions", []).extend(fresh)
    merged["sections"] = merged_secs
    # Meta (title/settings) ikut hasil baru; sections = hasil merge.
    if isinstance(new_draft, dict):
        for k in ("title", "description", "type", "settings"):
            if k in new_draft:
                merged[k] = copy.deepcopy(new_draft[k])
    added = len(fresh)
    requested = parse_requested_add(instruction)
    warns = list((new_draft.get("warnings") or []) if isinstance(new_draft, dict) else [])
    if requested and added < requested:
        warns.append(
            f"Minta tambah {requested} soal, AI menambah {added}. "
            "Generate sisa soal terpisah bila kurang."
        )
    merged["ignored"] = list((new_draft.get("ignored") or []) if isinstance(new_draft, dict) else [])
    merged["warnings"] = warns
    return merged


def detect_code_intent(text: str | None) -> str | list[str] | None:
    """Deteksi intent soal kode dari teks bebas.

    Return: bahasa fence (str) bila satu bahasa dominan, list[str] bila
    multi-bahasa (mis. "laravel dan react" -> ["php", "javascript"]),
    "" bila intent kode tanpa bahasa jelas, None bila bukan soal kode.
    Urutan: framework dulu (laravel->php, react->javascript), lalu bahasa
    umum, lalu keyword umum. Batas kata agar "decode" tak dikira intent kode.
    """
    t = f" {(text or '').lower()} "
    found: list[str] = []
    for fw, lang in _CODE_FRAMEWORK_MAP.items():
        if _word_hit(t, fw) and lang not in found:
            found.append(lang)
    for lang in _CODE_LANGS:
        if _word_hit(t, lang) and lang not in found:
            found.append(lang)
    if len(found) > 1:
        return found
    if len(found) == 1:
        return found[0]
    for hint in _CODE_HINTS:
        if _word_hit(t, hint):
            return ""
    return None


def build_user_text(prompt: str, refs: list[tuple[str, str]], title: str = "", description: str | None = None, form_type: str = "auto") -> str:
    parts = []
    if form_type == "quiz":
        parts.append("Jenis: KUIS (ada nilai & kunci jawaban)")
    elif form_type == "form":
        parts.append("Jenis: FORMULIR/pendataan (tanpa nilai)")
    else:
        parts.append("Jenis: TENTUKAN SENDIRI dari permintaan creator (quiz bila ada nilai/kunci/timer, selain itu form) lalu isi field type di JSON.")
    if (title or "").strip():
        parts.append(f"Judul awal: {title.strip()}")
    if description:
        parts.append(f"Deskripsi awal: {description}")
    parts.append(f"Permintaan creator:\n{prompt}")
    lang = detect_code_intent(f"{title} {description or ''} {prompt}")
    if lang is not None:
        n = _parse_requested_count(prompt)
        count_rule = f"Tulis TEPAT {n} soal, tidak kurang. " if n else ""
        code_rule = (
            "SETIAP soal WAJIB memuat potongan kode dalam fence (1-8 baris; 1 baris pun tetap fence, jangan sebaris dalam kalimat). "
            "Struktur question_text: kalimat pembuka (mis. 'Perhatikan kode berikut:'), "
            "lalu fence berisi kode, lalu kalimat pertanyaan. "
            "Di dalam fence pakai petik tunggal (') bukan petik ganda (\") bila memungkinkan. "
            "Penutup fence (```) WAJIB di baris sendiri. Jangan delimiter LaTeX untuk kode."
        )
        if isinstance(lang, list):
            fences = ", ".join(f"```{l}" for l in lang)
            parts.append(
                "Konteks: soal ini tentang KODE/PROGRAM, bukan rumus matematika. "
                f"{count_rule}"
                f"{code_rule} "
                f"Sebar fence sesuai materi ({fences})."
            )
        else:
            fence = f"```{lang}" if (lang and re.match(r'^[A-Za-z0-9+#_-]{1,20}$', lang)) else "```python"
            parts.append(
                "Konteks: soal ini tentang KODE/PROGRAM, bukan rumus matematika. "
                f"{count_rule}"
                f"{code_rule} "
                f"Pakai fence {fence} ... ``` ."
            )
    for fname, text in refs:
        parts.append(f"--- Isi file referensi {fname} ---\n{text}")
    return "\n\n".join(parts)


def build_edit_text(title: str, form_type: str, instruction: str, draft: dict, previous_prompts: list[str]) -> str:
    """Prompt edit hemat token: instruksi + draf JSON + riwayat prompt.

    Tanpa teks file referensi — draf sudah mengandung hasilnya. LLM hanya
    boleh tambah/ubah/hapus soal dalam JSON yang diberikan.
    """
    if form_type == "quiz":
        kind = "KUIS (ada nilai & kunci jawaban)"
    elif form_type == "form":
        kind = "FORMULIR/pendataan (tanpa nilai)"
    else:
        kind = str(((draft or {}).get("type") if isinstance(draft, dict) else "") or "auto")
        kind = "KUIS (ada nilai & kunci jawaban)" if kind == "quiz" else ("FORMULIR/pendataan (tanpa nilai)" if kind == "form" else "SAMA seperti draf (jangan ubah type kecuali instruksi minta)")
    parts = [
        f"Jenis: {kind}",
        f"Judul: {(title or '').strip() or ((draft or {}).get('title') if isinstance(draft, dict) else '') or '-'}",
        "Konteks: ini EDIT draf yang sudah ada, BUKAN generate dari awal. "
        "Ubah JSON draf berikut SESUAI instruksi saja — bagian yang tak disebut "
        "instruksi JANGAN diubah. Kembalikan JSON penuh yang valid "
        "(bentuk sama: title + description + type + sections + settings). "
        "Operasi didukung: hapus 1 soal, hapus semua soal, ubah 1 soal, "
        "ubah semua soal, tambah N soal. Hapus semua = kembalikan sections "
        "dengan questions kosong. Jangan karang di luar instruksi.",
        "ATURAN TAMBAH (bila instruksi minta TAMBAH/menambah soal): "
        "PERTAHANKAN semua soal yang sudah ada PERSIS APA ADANYA "
        "(jangan ubah, jangan hapus, jangan rephrase, jangan susutkan jumlahnya), "
        "lalu TAMBAHKAN soal baru di akhir section terkait. Jumlah soal akhir "
        "WAJIB lebih banyak dari draf awal — JANGAN PERNAH kembalikan lebih "
        "sedikit soal dari draf awal saat instruksi adalah menambah.",
        f"Instruksi creator:\n{instruction}",
    ]
    hist = [p.strip() for p in (previous_prompts or []) if p and p.strip()][:5]
    if hist:
        parts.append("Riwayat permintaan (konteks anti-halusinasi, jangan ditampilkan):\n" + "\n".join(f"- {p[:1000]}" for p in hist))
    parts.append(f"Draf saat ini (JSON):\n{json.dumps(draft, ensure_ascii=False)}")
    return "\n\n".join(parts)


def _gemini_models() -> list[str]:
    """Model utama + cadangan (dedupe). Kosong = tanpa fallback."""
    models = [m.strip() for m in (GEMINI_MODEL, GEMINI_FALLBACK_MODEL) if m and m.strip()]
    return list(dict.fromkeys(models)) or ["gemini-3.6-flash"]


def _scan_json_structure(text: str) -> tuple[bool, list[str], int]:
    """Scan struktur JSON sekali, sadar-string.

    Return (in_string, stack_tutup_terbuka, cut_pos):
    - in_string: True bila teks berakhir di dalam string JSON (quote tak tutup).
    - stack: urutan tutup yang masih terbuka ("}" / "]", paling dalam dulu).
    - cut_pos: indeks eksklusif batas objek/array lengkap terakhir di LUAR
      string (-1 bila tak ada). Kurung LaTeX (\\frac{a}{b}) di dalam string
      TIDAK dihitung karena pemindai tahu posisi di dalam string vs di luar.
    Escape ditangani: \\ membuat char berikut literal, \" bukan penutup string.
    """
    stack: list[str] = []
    in_string = False
    escaped = False
    cut_pos = -1
    for i, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            stack.append("}")
        elif ch == "[":
            stack.append("]")
        elif ch == "}" or ch == "]":
            if stack and stack[-1] == ch:
                stack.pop()
                cut_pos = i + 1
            # tutup liar tanpa pasangan: abaikan (biar json.loads yang menilai)
    return in_string, stack, cut_pos


def _repair_truncated_json(text: str) -> str:
    """Tutup JSON terpotong karena maxOutputTokens (mis. 20 soal passage).

    State-aware: kurung kurawal literal di dalam string JSON (mis. LaTeX
    \\frac{a}{b}) tidak dihitung sebagai struktur. Urutan tutup mengikuti
    stack (terdalam dulu), bukan tebakan tetap.
    """
    t = text.strip()
    in_string, stack, cut_pos = _scan_json_structure(t)
    if in_string:
        # Ekor dalam string tapi sudah ada pembuka struktur baru setelah batas
        # lengkap terakhir (mis. `...[]}, {"type": "essa`) → objek ekor tak
        # lengkap; buang ekor, pertahankan objek lengkap saja.
        tail = t[cut_pos:] if cut_pos > 0 else ""
        if cut_pos > 0 and ("{" in tail or "[" in tail):
            t = t[:cut_pos]
            in_string, stack, cut_pos = _scan_json_structure(t)
        else:
            # String kepotong: buang backslash ekor (escape yatim), tutup quote.
            t = t.rstrip("\\") + '"'
            in_string, stack, cut_pos = _scan_json_structure(t)
    if t.endswith(",") or t.endswith(":"):
        # Koma/kolon ekor: mundur ke batas objek/array lengkap terakhir
        # (di luar string) agar tak motong di dalam string LaTeX.
        _, _, cut_pos = _scan_json_structure(t)
        if cut_pos > 0:
            t = t[:cut_pos]
            _, stack, _ = _scan_json_structure(t)
    t += "".join(reversed(stack))
    # pastikan punya settings jika hilang
    if '"settings"' not in t:
        t = t.rstrip("}") + ', "settings": {"timer_minutes": 30}}'
    return t


def _repair_json_escapes(text: str) -> str:
    """Perbaiki backslash LaTeX yang tak di-escape Gemini (contoh \\( \\frac).

    JSON mode kadang mengembalikan perintah LaTeX mentah sehingga json.loads
    gagal (invalid \\escape) atau diam-diam korup (\\f jadi formfeed, \\t jadi
    tab). Aturan: perintah/delimiter LaTeX (\\frac, \\neq, \\(, ..., dikenali
    via _bfnrt_is_latex + huruf/paren/bracket) -> backslash digandakan;
    escape JSON valid (\\", \\\\, \\/, \\uXXXX, \\n/\\t/\\b/\\f/\\r yang bukan
    perintah) dibiarkan. Idempotent untuk output yang sudah benar.
    """
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch != "\\" or i + 1 >= n:
            out.append(ch)
            i += 1
            continue
        nxt = text[i + 1]
        if nxt in '"\\/':
            out.append(text[i:i + 2])
            i += 2
            continue
        if nxt == "u":
            hexpart = text[i + 2:i + 6]
            if len(hexpart) == 4 and all(c in "0123456789abcdefABCDEF" for c in hexpart):
                out.append(text[i:i + 6])
                i += 6
            else:  # \usepackage, \underbrace, ...
                out.append("\\\\")
                i += 1
            continue
        if nxt in "bfnrt":
            if _bfnrt_is_latex(nxt, text[i + 1:]):
                out.append("\\\\")  # \neq \frac \times \right ... (LaTeX)
                i += 1
            else:
                out.append(text[i:i + 2])  # escape JSON asli (\nbaru, \ttab, ...)
                i += 2
            continue
        if nxt.isalpha() or nxt in "()[]":
            out.append("\\\\")  # perintah/delimiter LaTeX
            i += 1
            continue
        out.append(text[i:i + 2])
        i += 2
    return "".join(out)


def _repair_json_controls(text: str) -> str:
    """Escape newline/tab asli di dalam string JSON (AI tulis fence multiline
    dengan newline mentah, bukan \\n — json.loads gagal 'Invalid control
    character'). Sadar-string: struktur di luar string tak disentuh."""
    out: list[str] = []
    in_string = False
    escaped = False
    for ch in text:
        if in_string:
            if escaped:
                out.append(ch)
                escaped = False
            elif ch == "\\":
                out.append(ch)
                escaped = True
            elif ch == '"':
                out.append(ch)
                in_string = False
            elif ch == "\n":
                out.append("\\n")
            elif ch == "\r":
                out.append("\\r")
            elif ch == "\t":
                out.append("\\t")
            else:
                out.append(ch)
            continue
        out.append(ch)
        if ch == '"':
            in_string = True
    return "".join(out)


def _parse_gemini_text(data: dict) -> dict:
    if data.get("promptFeedback", {}).get("blockReason"):
        raise AiFailed("Prompt ditolak filter keamanan AI. Coba ubah kata-katanya.")
    cands = data.get("candidates") or []
    text = (cands[0].get("content", {}).get("parts") or [{}])[0].get("text", "") if cands else ""
    # ponytail: cek finishReason truncated
    finish = (cands[0].get("finishReason") or "") if cands else ""
    truncated = finish == "MAX_TOKENS"
    if truncated:
        logger.warning("gemini: finishReason MAX_TOKENS, coba repair truncated")
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        try:  # ponytail: repair LaTeX mentah sebelum menyerah (hemat retry)
            parsed = json.loads(_repair_json_escapes(text))
            logger.info("gemini: JSON diperbaiki via escape-repair")
        except (ValueError, TypeError):
            try:  # newline/tab mentah di string (fence kode multiline) ->
                # escape control dulu, lalu LaTeX (urutan penting: \f mentah
                # harus digandakan SEBELUM loads agar tak korup jadi formfeed)
                parsed = json.loads(_repair_json_escapes(_repair_json_controls(text)))
                logger.info("gemini: JSON diperbaiki via control-repair")
            except (ValueError, TypeError):
                try:
                    # ponytail: repair untuk terpotong karena passage (overflow)
                    repaired = _repair_truncated_json(_repair_json_escapes(_repair_json_controls(text)))
                    parsed = json.loads(repaired)
                    logger.info("gemini: JSON diperbaiki via truncated-repair")
                    truncated = True
                except (ValueError, TypeError):
                    raise AiFailed("AI gagal menyusun draf (output terpotong). Coba generate ulang dengan 10 soal per batch.")
    if not isinstance(parsed, dict):
        raise AiFailed("AI gagal menyusun draf. Coba generate ulang.")
    if truncated:
        parsed["_truncated"] = True
    return parsed


def call_gemini(user_text: str, api_key: str, user_id: int | None = None, expected_total: int | None = None) -> tuple[dict, str]:
    """Panggil Gemini JSON mode. Balik (draf, model_terpakai).

    Key dikirim via header (tak muncul di URL/log). Tiap model dicoba 1x;
    gagal transient (429/5xx/network/JSON rusak) di model utama langsung
    lanjut ke fallback — worst-case ~2 mnt (2 model x 1 coba x 60 dtk) agar
    muat di timeout proxy/frontend. 401/403 (key salah) dan 400 langsung
    gagal tanpa buang kuota coba — fallback pakai key yang sama.
    expected_total = jumlah soal akhir yang diharapkan (edit-tambah:
    soal lama + N baru) agar budget output muat dan tak terpotong.
    """
    if not api_key or not api_key.strip():
        raise AiNotConfigured("API key Gemini belum diatur. Masukkan di Pengaturan.")
    api_key = api_key.strip()
    # ponytail: guard estimasi token sebelum panggil
    est_tokens = len(user_text) // 4 + 8192
    if expected_total:
        est_tokens += expected_total * 300 // 4
    if est_tokens > 100_000:
        raise AiFailed("Prompt + file referensi terlalu panjang untuk 20 soal. Coba 10 soal per batch atau kurangi teks passage.")
    budget = _output_budget(user_text, expected_total)
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [{"parts": [{"text": user_text}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.7, "maxOutputTokens": budget},
    }
    headers = {"x-goog-api-key": api_key}
    last_err: Exception | None = None
    for attempt, model in enumerate(_gemini_models(), start=1):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        t0 = time.monotonic()
        try:
            with httpx.Client(timeout=GEMINI_TIMEOUT) as client:
                resp = client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as e:
            logger.warning(
                "gemini attempt=%d model=%s user_id=%s: network error %s (%.0fms)",
                attempt, model, user_id, type(e).__name__, (time.monotonic() - t0) * 1000,
            )
            last_err = e
            continue
        elapsed_ms = (time.monotonic() - t0) * 1000
        if resp.status_code == 200:
            try:
                draft = _parse_gemini_text(resp.json())
                logger.info(
                    "gemini attempt=%d model=%s user_id=%s: ok (%.0fms)",
                    attempt, model, user_id, elapsed_ms,
                )
                return draft, model
            except AiFailed as e:
                logger.warning(
                    "gemini attempt=%d model=%s user_id=%s: draf tak valid (%s, %.0fms)",
                    attempt, model, user_id, e, elapsed_ms,
                )
                last_err = e
                continue
            except ValueError as e:
                logger.warning(
                    "gemini attempt=%d model=%s user_id=%s: respons bukan JSON (%.0fms)",
                    attempt, model, user_id, elapsed_ms,
                )
                last_err = e
                continue
        if resp.status_code in (401, 403):
            logger.error(
                "gemini attempt=%d model=%s user_id=%s: key ditolak (%s, %.0fms)",
                attempt, model, user_id, resp.status_code, elapsed_ms,
            )
            raise AiFailed("API key AI ditolak. Periksa key di Pengaturan.")
        if resp.status_code == 400:
            # ponytail: 400 bisa API key invalid (Google: "API key not valid") -> treat as key ditolak, bukan prompt error
            if "api key" in resp.text.lower():
                logger.error(
                    "gemini attempt=%d model=%s user_id=%s: 400 key invalid %.120s (%.0fms)",
                    attempt, model, user_id, resp.text, elapsed_ms,
                )
                raise AiFailed("API key AI ditolak. Periksa key di Pengaturan.")
            logger.warning(
                "gemini attempt=%d model=%s user_id=%s: 400 %.120s (%.0fms)",
                attempt, model, user_id, resp.text, elapsed_ms,
            )
            raise AiFailed("AI menolak permintaan. Coba ubah prompt lalu generate ulang.")
        if resp.status_code == 404:
            # ID model pensiun/diganti Google (kasus 2.x) — bukan "sibuk".
            logger.error(
                "gemini attempt=%d model=%s user_id=%s: 404 model tak tersedia (%.0fms)",
                attempt, model, user_id, elapsed_ms,
            )
            last_err = AiFailed(f"Model AI {model} tidak tersedia. Hubungi admin.")
            continue
        # 429 / 5xx -> langsung model berikut (tanpa retry) agar worst-case ~2 mnt.
        if resp.status_code == 429 and "quota" in resp.text.lower():
            logger.warning(
                "gemini attempt=%d model=%s user_id=%s: quota habis (%s, %.0fms)",
                attempt, model, user_id, resp.status_code, elapsed_ms,
            )
            last_err = AiFailed("Kuota Gemini Anda habis. Coba lagi besok atau ganti key.")
            continue
        logger.warning(
            "gemini attempt=%d model=%s user_id=%s: sibuk (%s, %.0fms)",
            attempt, model, user_id, resp.status_code, elapsed_ms,
        )
        last_err = AiFailed(f"AI sibuk ({resp.status_code}). Coba lagi sebentar lagi.")
    if isinstance(last_err, AiFailed):
        raise last_err
    raise AiFailed("AI tidak merespons. Periksa koneksi lalu coba lagi.")


GIBBERISH_MSG = "Prompt terdeteksi tidak jelas/aneh"

def detect_gibberish(text: str | None, min_len: int = 12) -> bool:
    """Heuristik prompt aneh/gibberish (hemat kuota, tanpa panggil AI).

    Trigger bila: kumulasi karakter sama (>=5), teks tanpa vokal, teks
    dengan vokal terlalu sada (dense konsonan, mash keyboard), <40% token
    ber-vokal, atau kadena alfanumerik/token berterusan aneh.
    """
    t = (text or "").strip()
    if not t or len(t) < min_len:
        return False
    if re.search(r"(.)\1{4,}", t, re.IGNORECASE):
        return True
    if re.search(r"(?i)([a-z]{2,})\1{2,}", t):  # bigram ulang ("asis asis asis")
        return True
    letters = [c for c in t if c.isalpha()]
    if letters:
        vowels = sum(1 for c in letters if c in "aeiouyAEIOUY")
        if not vowels:
            return True
        if len(letters) >= 10 and vowels / len(letters) < 0.2:
            return True
    if not any(c.isalpha() for c in t) and len(t) >= 10:
        return True  # cuma digit/simbol
    alpha_tokens = re.findall(r"[A-Za-z]+", t)
    if alpha_tokens:
        word_like = sum(
            1
            for tok in alpha_tokens
            if any(c in "aeiouyAEIOUY" for c in tok) and any(c not in "aeiouyAEIOUY" for c in tok)
        )
        if len(alpha_tokens) >= 3 and word_like / len(alpha_tokens) < 0.4:
            return True
        # Kadena aneh berterusan (mash keyboard) tanpa spasi.
        if len(alpha_tokens) == 1 and letters:
            vowels = sum(1 for c in letters if c in "aeiouyAEIOUY")
            if len(letters) >= 12 and vowels / len(letters) < 0.25:
                return True
    return False


# Konvensi rich-lite yang boleh dipakai AI di question_text/option_text:
# rumus \(...\) / \[...\] (KaTeX render di client), fence ```lang untuk kode,
# [teks](https://...) untuk link. Selain itu = teks polos.
# Pembuka fence valid: ``` + token bahasa + TERMINATOR (spasi/newline/backtick).
# Lookahead mencegah lang terpotong ("c++x..." tak jadi lang "c++") dan
# karakter asing ("evil\"...") — keduanya gagal jadi fence = teks biasa.
_FENCE_RE = re.compile(r"```([A-Za-z0-9+#_-]{0,20})(?=[ \t\n`])[ \t]*\n?(.*?)```", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`([^`\n]{1,500})`")
_LINK_RE = re.compile(r"\[([^\]\n]{1,300})\]\(([^)\s]{1,500})\)")
_URL_OK_RE = re.compile(r"^https?://[^\s<>\"]+$", re.IGNORECASE)
_LANG_OK_RE = re.compile(r"^[A-Za-z0-9+#_-]{1,20}$")

# Perintah LaTeX umum berawalan huruf escape JSON (b/f/n/r/t) — dipakai untuk
# membedakan "\neq" (LaTeX) dari "\n..." + kata (newline asli, mis. "\nbaru").
# Cocok hanya bila diikuti batas kata; sisanya dianggap escape JSON.
_LATEX_BFNRT = {
    "b": ("binom", "boldsymbol", "bigodot", "bigoplus", "bigotimes", "bigg", "bigl", "bigm", "bigr", "big", "bmod", "bot", "bowtie", "breve", "bullet", "bar", "box"),
    "f": ("frac", "fbox"),
    "n": ("notin", "nexists", "nabla", "neq", "ni"),
    "r": ("rightarrow", "rfloor", "rceil", "rangle", "right"),
    "t": ("triangle", "theta", "tilde", "times", "tau", "top", "to"),
}


def _bfnrt_is_latex(letter: str, rest: str) -> bool:
    for cmd in _LATEX_BFNRT[letter]:
        if rest.startswith(cmd) and (len(rest) == len(cmd) or not rest[len(cmd)].isalpha()):
            return True
    return False

# headroom untuk tag yang disisipkan konverter (batas kolom 5000/2000)
_RICH_HEADROOM = 500


def _inline_rich(esc: str, parts: list[str]) -> str:
    """Inline code + link di atas teks yang SUDAH di-escape. Tanpa placeholder
    bersarang: tiap temuan langsung jadi placeholder bernomor."""

    def inline_sub(m: re.Match) -> str:
        parts.append(f"<code>{m.group(1)}</code>")
        return f"\x00{len(parts) - 1}\x00"

    esc = _INLINE_CODE_RE.sub(inline_sub, esc)

    def link_sub(m: re.Match) -> str:
        url = html.unescape(m.group(2)).strip()
        if not _URL_OK_RE.match(url):
            return m.group(0)  # skema asing (javascript:/data:) = biarkan teks
        parts.append(f'<a href="{html.escape(url, quote=True)}">{m.group(1)}</a>')
        return f"\x00{len(parts) - 1}\x00"

    esc = _LINK_RE.sub(link_sub, esc)
    return esc


# Tanda kode sebaris panjang (AI lupa fence): 2+ pola khas kode dalam satu
# baris — mis. "const [a, b] = useState(..); ...setX(..);".
_CODE_SMELL_RES = (
    re.compile(r"\b(const|let|var|function|return|import|from|useState|useEffect|Route|SELECT|FROM|WHERE)\b", re.IGNORECASE),
    re.compile(r"=>|===|!==|::|->|\$[A-Za-z_]"),
    re.compile(r"[A-Za-z_$][\w$]*\s*\([^)]*\)\s*;"),
    re.compile(r";.*;\s*\S"),
    re.compile(r"<[a-zA-Z][a-zA-Z0-9]*(\s[^<>]*)?/?>"),  # tag HTML/JSX
    re.compile(r"\?.*:"),  # ternary a ? b : c
)

# Tanda baca kode: bedakan kode asli dari prosa yang menyebut nama kode.
# "useEffect tidak diperbolehkan..." (tanpa (), {}, ;, =) = prosa, bukan kode.
_CODE_PUNCT_RES = (
    re.compile(r"=>|::|->"),
    re.compile(r"<[a-zA-Z][a-zA-Z0-9]*(\s[^<>]*)?/?>"),
    re.compile(r"[A-Za-z_$][\w$]*\s*\("),
    re.compile(r"[;{}]"),
    re.compile(r"\$[A-Za-z_]"),
    re.compile(r"\b(const|let|var)\b\s*[\w${}\[\]\s,]*="),
    re.compile(r"[A-Za-z0-9_\)\]]\s*=\s*[^=]"),
)

# Kata kunci kode — HANYA dihitung bila ditemani tanda baca kode di atas.
_STRONG_KW_RES = (
    re.compile(r"\b(const|let|var|function|return|import|from|useState|useEffect|Route|SELECT|FROM|WHERE|def|elif|except|console)\b", re.IGNORECASE),
)


def _looks_like_unfenced_code(line: str, strict: bool = False) -> bool:
    """True bila baris tanpa fence tapi sarat pola kode.

    strict=True (soal coding): butuh tanda baca kode — 2+ tanda, atau
    1 tanda + kata kunci (panjang >=25). Prosa tanpa (), {}, ;, =
    ("useEffect tidak diperbolehkan...") TIDAK dianggap kode.
    strict=False: ambang normal 60 char + 2 pola (anti false-positive prosa).
    """
    s = line.strip()
    if "```" in s:
        return False
    if strict and len(s) >= 25:
        n_punct = sum(1 for rx in _CODE_PUNCT_RES if rx.search(s))
        if n_punct >= 2:
            return True
        if n_punct >= 1 and any(rx.search(s) for rx in _STRONG_KW_RES):
            return True
        return False
    if len(s) < 60:
        return False
    return sum(1 for rx in _CODE_SMELL_RES if rx.search(s)) >= 2


def _wrap_unfenced_code_lines(text: str, lang: str = "plain", strict: bool = False) -> str:
    """Bungkus baris kode sebaris AI jadi fence agar render code-block.

    Baris kode BERURUTAN digabung dalam SATU fence (bukan satu fence per
    baris) agar tidak tumpang-tindih blok. Nama bahasa di awal baris
    ("javascript const x = ...") dikupas jadi atribut fence.
    """
    out: list[str] = []
    buf: list[str] = []
    buf_indent = ""
    in_fence = False

    def flush() -> None:
        if buf:
            out.append(f"{buf_indent}```{lang}\n" + "\n".join(buf) + f"\n{buf_indent}```")
            buf.clear()

    for line in text.split("\n"):
        # Sudah dalam fence AI -> biarkan utuh, jangan bungkus ulang.
        if "```" in line:
            flush()
            in_fence = not in_fence if line.count("```") % 2 else in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        if _looks_like_unfenced_code(line, strict):
            s = line.strip()
            # kupas label bahasa nyangkut ("javascript const x" -> "const x")
            if strict:
                w = s.split(None, 1)
                if len(w) == 2 and w[0].lower() in (
                    *_CODE_LANGS, *_CODE_FRAMEWORK_MAP, "plain", "text",
                    "code", "kode", "js", "py", "ts",
                ):
                    s = w[1].lstrip()
            if not buf:
                buf_indent = line[: len(line) - len(line.lstrip())]
            buf.append(s)
        else:
            flush()
            out.append(line)
    flush()
    return "\n".join(out)


_LANG_LABEL_WORDS = frozenset((
    *_CODE_LANGS, *_CODE_FRAMEWORK_MAP,
    "plain", "text", "code", "kode", "js", "py", "ts",
))


def _strip_lang_label(code: str) -> str:
    """Kupas label bahasa nyangkut di awal isi fence ('javascript const x')."""
    first, sep, rest = code.partition("\n")
    w = first.strip().split(None, 1)
    if w and w[0].lower() in _LANG_LABEL_WORDS and (sep or len(w) == 2):
        return (w[1] if len(w) == 2 else "") + ("\n" + rest if sep else "")
    return code


def _merge_adjacent_fences(text: str) -> str:
    """Gabung fence berurutan (pemisah hanya whitespace) jadi satu blok."""
    matches = list(_FENCE_RE.finditer(text))
    if len(matches) < 2:
        return text
    out: list[str] = []
    pos = 0
    i = 0
    while i < len(matches):
        m = matches[i]
        group = [m]
        j = i + 1
        while j < len(matches) and matches[j].start() >= group[-1].end() and not text[group[-1].end():matches[j].start()].strip():
            group.append(matches[j])
            j += 1
        if len(group) == 1:
            out.append(text[pos:m.end()])
            pos = m.end()
        else:
            lang = ""
            bodies: list[str] = []
            for g in group:
                if not lang:
                    lang = (g.group(1) or "").strip().lower()
                body = _strip_lang_label(g.group(2).strip("\n")).strip("\n")
                if body:
                    bodies.append(body)
            merged = (f"```{lang}\n" if lang else "```\n") + "\n".join(bodies) + "\n```"
            out.append(text[pos:group[0].start()] + merged)
            pos = group[-1].end()
        i = j
    out.append(text[pos:])
    return "".join(out)


def _normalize_ai_entities(s: str) -> str:
    """Decode entitas HTML dari output AI sebelum escape.

    Gemini kadang mengembalikan teks yang sudah ter-escape
    (mis. "&#039;", "&quot;", "&amp;") — tanpa ini html.escape di bawah
    meng-escape ulang "&" jadi "&amp;#039;" (double-escape) sehingga tampil
    mentah di preview. Loop hingga stabil untuk data escape-ganda.
    Idempotent: teks polos tanpa entitas tidak berubah; "&lt;tag&gt;" balik
    jadi "<tag>" lalu di-escape lagi jadi "&lt;tag&gt;" (tetap literal).
    """
    prev = s or ""
    for _ in range(3):
        cur = html.unescape(prev)
        if cur == prev:
            break
        prev = cur
    return prev


def _rich_lite_to_html(text: str, code_lang: str = "plain", strict_code: bool = False) -> str:
    """Ubah konvensi rich-lite AI -> HTML allowlist frontend.

    Aman by construction: tiap segmen teks di-escape dulu, lalu hanya tag yang
    dibuat fungsi ini yang disisipkan (<div>/<code>/<a href http(s)>).
    HTML mentah dari AI TIDAK pernah passthrough (tampil sebagai teks).
    Delimiter LaTeX dibiarkan — KaTeX auto-render di client (pre/div kode
    dikecualikan render via ignoredTags).
    Baris kode sebaris (AI lupa fence) otomatis dibungkus fence; strict_code
    (soal coding) pakai ambang rendah agar kode 1-baris ikut tertangkap.
    """
    text = _normalize_ai_entities(text)
    text = _wrap_unfenced_code_lines(text, code_lang, strict_code)
    # AI bandel: banyak fence 1-baris berurutan -> gabung jadi satu blok agar
    # tidak tumpang-tindih. Hanya teks polos di antaranya yang digabung juga;
    # bila ada kalimat prosa di tengah, biarkan terpisah.
    text = _merge_adjacent_fences(text)
    parts: list[str] = []
    out: list[str] = []
    pos = 0
    for m in _FENCE_RE.finditer(text):
        out.append(_inline_rich(html.escape(text[pos:m.start()], quote=True), parts))
        lang = (m.group(1) or "").strip().lower()
        code = m.group(2).strip("\n")
        # AI bandel: bahasa di baris pertama kode ("```\njavascript const X..."
        # atau "```\njavascript" saja) -> angkat jadi atribut.
        if not lang:
            first, _, rest = code.partition("\n")
            w = first.strip().split()
            tok = w[0].lower() if w else ""
            if tok and re.fullmatch(r"[a-z0-9+#_-]{1,20}", tok) and (tok in _CODE_LANGS or tok in _CODE_FRAMEWORK_MAP or tok in ("plain", "text", "code", "kode", "js", "py", "ts")):
                lang = {"js": "javascript", "py": "python", "ts": "typescript"}.get(tok, tok)
                if lang in _CODE_FRAMEWORK_MAP:
                    lang = _CODE_FRAMEWORK_MAP[lang]
                tail = first.strip()[len(w[0]):].lstrip()
                code = (tail + "\n" + rest).lstrip("\n") if tail else rest.lstrip("\n")
        lang = lang or "plain"
        if not _LANG_OK_RE.match(lang):
            lang = "plain"
        code = code[:4000]
        parts.append(
            '<div class="ql-code-block-container">'
            f'<div class="ql-code-block" data-language="{lang}">'
            f"{html.escape(code, quote=True)}"
            "</div></div>"
        )
        out.append(f"\x00{len(parts) - 1}\x00")
        pos = m.end()
    out.append(_inline_rich(html.escape(text[pos:], quote=True), parts))
    esc = "".join(out)
    # kembalikan potongan (terdalam dulu agar placeholder bersarang aman)
    for i in range(len(parts) - 1, -1, -1):
        esc = esc.replace(f"\x00{i}\x00", parts[i])
    return esc


def _primary_code_lang(intent: str | list[str] | None) -> str:
    """Ambil bahasa utama dari hasil detect_code_intent untuk safety-net fence."""
    if isinstance(intent, list):
        lang = intent[0] if intent else ""
    else:
        lang = intent or ""
    if lang and _LANG_OK_RE.match(lang):
        return lang.lower()
    return "plain"


def _coerce_question(raw: dict, code_intent: str | list[str] | None = None) -> dict | None:
    """Bersihkan 1 soal AI -> dict valid QuestionCreate, atau None bila sampah."""
    if not isinstance(raw, dict):
        return None
    q_type = raw.get("type") if raw.get("type") in QUESTION_TYPES else None
    text = str(raw.get("question_text") or "").strip()
    if not q_type or not text:
        return None
    # B-light: bersihkan delimiter wacana yang bandel ("---"/"--") — ambil stem terakhir saja
    if "\n\n---\n\n" in text:
        text = text.split("\n\n---\n\n")[-1].strip()
    if " --- " in text:
        # kasus AI nakal: "cerita --- soal" dalam 1 baris
        text = text.split(" --- ")[-1].strip()
    # Bahasa safety-net: deteksi per-soal dulu (tepat untuk prompt campuran
    # laravel+react), lalu sintaks khas (Route:: -> php meski soal tak sebut
    # bahasa), fallback ke intent level-prompt.
    opt_texts = " ".join(
        str(o.get("option_text") or "")
        for o in ((raw.get("options") or []) if isinstance(raw.get("options"), list) else [])
        if isinstance(o, dict)
    )
    q_text = f"{text} {opt_texts}"
    q_intent = detect_code_intent(q_text)
    sniffed = _sniff_code_lang(q_text, q_intent or code_intent)
    code_lang = sniffed or _primary_code_lang(q_intent if q_intent else code_intent)
    strict = bool(code_intent or q_intent or sniffed or code_lang != "plain")
    text = _rich_lite_to_html(text[:5000 - _RICH_HEADROOM], code_lang, strict)
    opts: list[dict] = []
    if q_type in OPTION_TYPES:
        for o in (raw.get("options") or [])[:MAX_OPTIONS]:
            if not isinstance(o, dict):
                continue
            t = str(o.get("option_text") or "").strip()
            if t:
                opts.append({"option_text": _rich_lite_to_html(t[:2000 - _RICH_HEADROOM], code_lang, strict), "is_correct": bool(o.get("is_correct"))})
        if not opts:
            return None
    try:
        points = int(raw.get("points", 1))
    except (TypeError, ValueError):
        points = 1
    kw = str(raw.get("password_keyword") or "").strip() or None
    # answer_key: LLM dilarang mengarang kunci (lihat SYSTEM_INSTRUCTION) —
    # paksa null agar soal tak gugur validasi; creator mengisi saat review.
    # allow_other: teruskan hanya untuk MC/checkbox, selain itu False.
    allow_other = bool(raw.get("allow_other", False)) and q_type in ("multiple_choice", "checkbox")
    # B-light: nonaktifkan group/wacana total — selalu null, hemat token & anti-duplikasi
    raw_gid = None
    try:
        q = QuestionCreate(
            type=q_type,
            question_text=text,
            points=max(0, min(999, points)),
            is_required=bool(raw.get("is_required", True)),
            group_id=raw_gid,
            password_keyword=kw if q_type == "password" else None,
            answer_key=None,
            allow_other=allow_other,
            options=opts,
        )
    except Exception:
        return None
    return q.model_dump()


def sanitize_draft(raw: dict, form_type: str = "auto", prompt_text: str = "") -> dict:
    """Bersihkan output AI -> draf valid. Raise AiFailed bila tak ada soal layak."""
    code_intent = detect_code_intent(prompt_text)
    resolved_type = form_type if form_type in ("form", "quiz") else str(raw.get("type") or "").strip().lower()
    if resolved_type not in ("form", "quiz"):
        low = (prompt_text or "").lower()
        if any(w in low for w in ("kuis", "quiz", "ujian", "ulangan", "nilai", "kunci jawaban", "timer", "menit")):
            resolved_type = "quiz"
        else:
            resolved_type = "form"
    sections: list[dict] = []
    total = 0
    for s in (raw.get("sections") or [])[:MAX_SECTIONS]:
        title = str((s or {}).get("title") or "").strip()[:150] or "Bagian"
        questions: list[dict] = []
        for q in ((s or {}).get("questions") or []):
            if total >= MAX_QUESTIONS:
                break
            clean = _coerce_question(q, code_intent)
            if clean:
                questions.append(clean)
                total += 1
        if questions:
            sections.append({"title": title, "questions": questions})
    if not sections:
        raise AiFailed("AI tidak menghasilkan soal yang valid. Coba perjelas prompt lalu generate ulang.")

    settings = raw.get("settings") or {}
    try:
        timer = settings.get("timer_minutes")
        timer = int(timer) if timer is not None else None
        timer = timer if timer is not None and 1 <= timer <= 1440 else None
    except (TypeError, ValueError):
        timer = None
    sub = settings.get("submission_limit")
    is_quiz_type = resolved_type == "quiz"
    ai_title = re.sub(r"<[^>]*>", "", _normalize_ai_entities(str(raw.get("title") or ""))).strip()[:1000]
    if not ai_title:
        ai_title = " ".join((prompt_text or "").split())[:80] or "Form tanpa judul"
    ai_desc = re.sub(r"<[^>]*>", "", _normalize_ai_entities(str(raw.get("description") or ""))).strip()[:5000] or None

    def _dt(v):
        s = str(v or "").strip()
        if not s:
            return None
        try:
            from app.schemas.form import _parse_datetime

            _parse_datetime(s)
            return s
        except Exception:
            return None

    # Scoring selalu auto dari AI page (pilihan dihapus di frontend) —
    # paksa di sini agar draft lama/AI bandel tetap auto.
    scoring = "auto"
    starts = _dt(settings.get("starts_at"))
    ends = _dt(settings.get("ends_at"))
    if starts and ends:
        try:
            from app.schemas.form import _parse_datetime

            if _parse_datetime(starts) >= _parse_datetime(ends):
                starts = ends = None
        except Exception:
            starts = ends = None
    draft = {
        "title": ai_title,
        "description": ai_desc,
        "type": resolved_type,
        "sections": sections,
        "settings": {
            "shuffle_questions": bool(settings.get("shuffle_questions", False)),
            "shuffle_options": bool(settings.get("shuffle_options", False)),
            "timer_minutes": timer,
            "require_login": bool(settings.get("require_login", False)),
            "submission_limit": sub if sub in ("unlimited", "once") else "unlimited",
            "show_leaderboard": bool(settings.get("show_leaderboard", False)) and is_quiz_type,
            "is_restricted": bool(settings.get("is_restricted", False)),
            "show_in_history": bool(settings.get("show_in_history", True)),
            "reveal_score": bool(settings.get("reveal_score", True)),
            "reveal_answers": bool(settings.get("reveal_answers", True)),
            "display_style": "card",
            "scoring_mode": scoring if is_quiz_type else "auto",
            "starts_at": starts,
            "ends_at": ends,
        },
    }
    if resolved_type == "quiz" and timer is None:
        if "timer" in (prompt_text or "").lower() or "menit" in (prompt_text or "").lower():
            timer = 30
            draft["settings"]["timer_minutes"] = 30
        else:
            raise AiFailed("AI tidak menyertakan timer untuk kuis. Coba generate ulang.")
    draft["ignored"] = detect_ignored(prompt_text, draft["settings"])
    draft["warnings"] = detect_count_warnings(prompt_text, total, truncated=bool(raw.get("_truncated")))
    return draft


def detect_count_warnings(prompt_text: str, actual: int, truncated: bool = False) -> list[str]:
    """Warning jumlah soal: minta N dapat M (<N) karena token/kompleksitas.

    Tanpa panggilan AI tambahan (hemat kuota). Kembalikan list string siap
    tampil, mis. 'Minta 30 soal, AI membuat 18 (batas token)'.
    """
    requested = _parse_requested_count(prompt_text)
    out: list[str] = []
    if requested and actual < requested:
        reason = "batas token" if truncated else "soal kompleks"
        out.append(
            f"Minta {requested} soal, AI membuat {actual} ({reason}). "
            "Kurangi kompleksitas per soal atau generate sisa soal terpisah."
        )
    elif truncated:
        out.append(
            f"AI membuat {actual} soal (output mencapai batas token). "
            "Generate sisa soal terpisah bila kurang."
        )
    return out


def detect_ignored(prompt_text: str, settings: dict) -> list[str]:
    """Minta user menyebut fitur X tapi AI tak menyetelnya -> label untuk warning box.

    Murni heuristik substring (ID+EN), tanpa panggilan AI tambahan (hemat kuota).
    """
    p = (prompt_text or "").lower()
    out: list[str] = []

    def has(*words: str) -> bool:
        return any(w in p for w in words)

    for label, words in IGNORED_KEYWORDS:
        if has(*words):
            out.append(label)
    s = settings or {}
    if has("leaderboard", "peringkat", "papan skor", "ranking") and not s.get("show_leaderboard"):
        out.append("leaderboard")
    if has("jadwal", "dibuka", "ditutup", "berakhir", "deadline", "batas waktu", "tanggal mulai", "tanggal selesai") and not (s.get("starts_at") or s.get("ends_at")):
        out.append("jadwal")
    if has("skor manual", "bobot nilai", "penilaian manual", "manual scoring") and s.get("scoring_mode") == "auto":
        out.append("mode penilaian")
    if has("sembunyikan skor", "sembunyikan nilai", "tanpa skor") and s.get("reveal_score"):
        out.append("tampil skor")
    if has("sembunyikan kunci", "sembunyikan jawaban", "tanpa pembahasan") and s.get("reveal_answers"):
        out.append("tampil jawaban")
    if has("sembunyikan dari riwayat", "tanpa riwayat") and s.get("show_in_history"):
        out.append("riwayat")
    if has("terbatas", "restricted", "hanya undangan") and not s.get("is_restricted"):
        out.append("mode terbatas")
    return list(dict.fromkeys(out))
