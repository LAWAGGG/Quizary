import html
import re
import io
import os
import uuid
from collections import Counter
from html.parser import HTMLParser as _HTMLParser

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from fastapi import Form as ApiForm
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import verify_form_owner
from app.models.form import Form, ScoringMode
from app.routers.questions import _insert_order_for_section
from app.models.image import Image
from app.models.question import Question, QuestionType, Section
from app.models.question_option import QuestionOption
from app.services.points import distribute_quiz_points
from app.utils import UPLOAD_DIR, MAX_DOCX_BYTES, now_wib, read_limited

# Reuse AI rich-lite → HTML (fence/code/link) agar impor docx konsisten dengan AI:
# - literal HTML "<a href>" di-escape jadi "&lt;a&gt;" (tampil sebagai kode, bukan WYSIWYG)
# - Word hyperlink w:hyperlink → "[text](url)" → <a href> via _rich_lite_to_html
# - unfenced code lines → ql-code-block. Fallback plain → HTML aman.
try:
    from app.services.ai_generate import (
        _rich_lite_to_html as _ai_rich_to_html,
        detect_code_intent as _ai_detect_intent,
        _primary_code_lang as _ai_primary_lang,
        _sniff_code_lang as _ai_sniff_lang,
    )
except Exception:  # pragma: no cover — saat test tanpa deps AI
    _ai_rich_to_html = None
    _ai_detect_intent = None
    _ai_primary_lang = None
    _ai_sniff_lang = None


def _docx_text_to_html(raw: str | None) -> str:
    """Docx plain-text (dengan \\n/\\t/markdown link) → HTML allowlist frontend.

    Tanpa ini, "<div>" literal lolos HAS_TAG_RE → sanitize keep <div> → WYSIWYG,
    atau "&lt;div&gt;" ter-strip jadi "html" saja. Dengan ini, literal di-escape
    dan hyperlink Word "[text](url)" jadi <a>. Inline HTML tags yang masih
    lolos sebagai "&lt;...&gt;" dibungkus <code> agar tampil sebagai kode.
    """
    if not raw or not raw.strip():
        return raw or ""
    html_out: str | None = None
    code_lang = "plain"
    strict = False
    try:
        if _ai_detect_intent and _ai_rich_to_html:
            intent = _ai_detect_intent(raw)
            sniffed = _ai_sniff_lang(raw, intent) if _ai_sniff_lang else None
            code_lang = (sniffed or _ai_primary_lang(intent) if intent and _ai_primary_lang else sniffed) or "plain"
            strict = bool(intent or sniffed or code_lang != "plain")
            html_out = _ai_rich_to_html(raw, code_lang, strict)
    except Exception:
        html_out = None
    if html_out is None:
        html_out = html.escape(raw, quote=True)
    # Literal HTML tags yang lolos sebagai "&lt;tag&gt;" (mis. "<a href>" ketik manual)
    # harus tampil sebagai kode, bukan dirender WYSIWYG atau ter-strip jadi "html".
    # _ai_rich_to_html sudah escape, tapi frontend resolveRichHtml akan decode
    # "&lt;a&gt;" → "<a>" → jadi link. Bungkus sebagai <code> agar stay escaped.
    if "&lt;" in html_out and "ql-code-block" not in html_out and "<code>" not in html_out:
        # Wrap each escaped tag like &lt;div ...&gt; / &lt;/a&gt; as inline code
        # Pattern harus handle &quot; di dalam atribut (mis. &lt;a href=&quot;...&quot;&gt;)
        html_out = re.sub(r'&lt;/?[a-zA-Z].*?&gt;', lambda m: f"<code>{m.group(0)}</code>", html_out)
    return html_out

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
NUMBERED_RE = re.compile(r'^\s*\d+[\.\)]\s*(.*)$', re.DOTALL)
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


M_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"


def _para_text_with_math(p) -> str:
    parts: list[str] = []

    def push(seg: str, math: bool = False):
        if not seg:
            return
        if parts:
            prev = parts[-1]
            if prev and ((math and prev[-1].isalnum()) or (prev.endswith("\\)") and seg[0].isalnum())):
                parts.append(" ")
        parts.append(seg)

    for child in p._p:
        tag = child.tag.split("}", 1)[1] if "}" in child.tag else child.tag
        if tag == "r":
            # Preserve order of t / br / tab inside w:r — needed for indent & enter
            for elem in child:
                etag = elem.tag.split("}", 1)[1] if "}" in elem.tag else elem.tag
                if etag == "t":
                    txt = elem.text or ""
                    pos = 0
                    for m in _TEXT_LATEX_RE.finditer(txt):
                        push(txt[pos:m.start()])
                        push("\\(%s\\)" % m.group(0), math=True)
                        pos = m.end()
                    push(txt[pos:])
                elif etag == "br":
                    push("\n")
                elif etag == "tab":
                    push("\t")
                elif etag == "cr":
                    push("\n")
        elif tag == "hyperlink":
            # Word hyperlink (Insert Hyperlink) — preserve URL as markdown [text](url)
            # so downstream _rich_lite_to_html can become <a href>.
            try:
                r_id = child.get(f"{R_NS}id") or child.get(f"{R_NS}embed")
                url = ""
                if r_id and hasattr(p, "part") and p.part.rels.get(r_id):
                    rel = p.part.rels[r_id]
                    if not rel.is_external:
                        url = rel.target_ref
                    else:
                        url = rel.target_ref
                # Extract visible text inside hyperlink (may contain w:r / w:t / w:br)
                inner_parts: list[str] = []
                for elem in child.iter():
                    etag = elem.tag.split("}", 1)[1] if "}" in elem.tag else elem.tag
                    if etag == "t":
                        inner_parts.append(elem.text or "")
                    elif etag == "br":
                        inner_parts.append("\n")
                    elif etag == "tab":
                        inner_parts.append("\t")
                inner = "".join(inner_parts)
                if url and inner:
                    push(f"[{inner}]({url})")
                elif inner:
                    push(inner)
                else:
                    # Fallback: extract any t
                    push("".join(t.text or "" for t in child.findall(f".//{WORD_NS}t")))
            except Exception:
                push("".join(t.text or "" for t in child.findall(f".//{WORD_NS}t")))
        elif tag in ("oMath", "oMathPara"):
            latex = _omml_fix_pipes(_omml_to_latex(child)).strip()
            if latex.startswith(".") and parts and re.fullmatch(r"[A-Ja-j]\.?", parts[-1].strip()):
                parts[-1] = parts[-1].rstrip() + ". "
                latex = latex[1:].strip()
            if latex:
                push("\\(%s\\)" % latex, math=True)
        elif tag not in ("pPr", "bookmarkStart", "bookmarkEnd", "proofErr", "permStart", "permEnd", "sectPr"):
            # Generic: smartTag, etc — walk in document order, keep br/tab
            for elem in child.iter():
                etag = elem.tag.split("}", 1)[1] if "}" in elem.tag else elem.tag
                if etag == "t":
                    txt = elem.text or ""
                    pos = 0
                    for m in _TEXT_LATEX_RE.finditer(txt):
                        push(txt[pos:m.start()])
                        push("\\(%s\\)" % m.group(0), math=True)
                        pos = m.end()
                    push(txt[pos:])
                elif etag == "br":
                    push("\n")
                elif etag == "tab":
                    push("\t")
                elif etag == "cr":
                    push("\n")
    return "".join(parts)

_LATEX_ESCAPE_RE = re.compile(r"([&%$#_{}])")

_TEXT_LATEX_RE = re.compile(r"\\(?:alpha|beta|gamma|delta|varepsilon|theta|lambda|mu|pi|sigma|phi|omega|Delta)(?![A-Za-z])")

_STRAY_LATEX_CLOSE_RE = re.compile(r"\\\)([})\]])")


def _omml_fix_pipes(latex: str) -> str:
    if "|" not in latex:
        return latex
    depth = 0
    out: list[str] = []
    i = 0
    while i < len(latex):
        c = latex[i]
        if c == "{":
            depth += 1
            out.append(c)
        elif c == "}":
            depth = max(0, depth - 1)
            out.append(c)
        elif c == "|" and depth == 0:
            if out and out[-1] in ("{", "(", "[", "+", "-", "=", " "):
                out.append("\\lvert ")
            else:
                out.append(" \\rvert")
        elif c == "|" and out and out[-1] == "{":
            out.append("\\lvert ")
        else:
            out.append(c)
        i += 1
    return "".join(out)


def _strip_latex_delims(text: str) -> str:
    cleaned = _STRAY_LATEX_CLOSE_RE.sub(r"\1", text)
    return cleaned.replace("\\(", "").replace("\\)", "")

_OMML_UNICODE_MAP = {
    "→": "\\to ",
    "←": "\\gets ",
    "↔": "\\leftrightarrow ",
    "⇒": "\\Rightarrow ",
    "⟹": "\\implies ",
    "≤": "\\le ",
    "≥": "\\ge ",
    "≠": "\\neq ",
    "×": "\\times ",
    "⋅": "\\cdot ",
    "−": "-",
    " ": " ",
    " ": " ",
    "∞": "\\infty ",
    "∂": "\\partial ",
    "∇": "\\nabla ",
    "α": "\\alpha ",
    "β": "\\beta ",
    "γ": "\\gamma ",
    "δ": "\\delta ",
    "ε": "\\varepsilon ",
    "θ": "\\theta ",
    "λ": "\\lambda ",
    "μ": "\\mu ",
    "π": "\\pi ",
    "σ": "\\sigma ",
    "φ": "\\phi ",
    "ω": "\\omega ",
    "Δ": "\\Delta ",
}

_OMML_NARY_MAP = {
    "∑": "\\sum ",
    "∏": "\\prod ",
    "∫": "\\int ",
    "∬": "\\iint ",
    "∭": "\\iiint ",
    "∮": "\\oint ",
    "⋃": "\\bigcup ",
    "⋂": "\\bigcap ",
    "⋁": "\\bigvee ",
    "⋀": "\\bigwedge ",
}

_OMML_FUNC_NAMES = (
    "limsup", "liminf", "sinh", "cosh", "tanh", "sin", "cos", "tan",
    "sec", "csc", "cot", "log", "ln", "lg", "lim", "det", "exp",
    "arg", "deg", "gcd", "inf", "sup", "max", "min", "Pr",
)

_OMML_FUNC_RE = re.compile(r"(?<!\\)\b(" + "|".join(_OMML_FUNC_NAMES) + r")(?![A-Za-z])")


def _omml_text(raw: str) -> str:
    esc = _LATEX_ESCAPE_RE.sub(r"\\\1", raw)
    for src, dst in _OMML_UNICODE_MAP.items():
        if src in esc:
            esc = esc.replace(src, dst)
    return esc


def _omml_child(el, name):
    return el.find(f"{M_NS}{name}")


def _omml_run_text(el) -> str:
    return "".join(
        _omml_text(t.text or "")
        for t in list(el.findall(f".//{M_NS}t")) + list(el.findall(f".//{WORD_NS}t"))
    )


def _omml_delim(el, name: str, default: str) -> str:
    node = _omml_child(el, name)
    if node is None:
        return default
    val = node.get(f"{WORD_NS}val")
    return val if val else ""


def _omml_to_latex(el) -> str:
    tag = el.tag.split("}", 1)[1] if "}" in el.tag else el.tag
    if tag == "t":
        return _omml_text(el.text or "")
    if tag == "r":
        return _omml_run_text(el)
    if tag in ("oMath", "oMathPara", "e", "num", "den", "deg", "lim", "sub", "sup", "fName"):
        return "".join(_omml_to_latex(c) for c in el)
    if tag == "f":
        num = _omml_child(el, "num")
        den = _omml_child(el, "den")
        return "\\frac{%s}{%s}" % (
            _omml_to_latex(num) if num is not None else "",
            _omml_to_latex(den) if den is not None else "",
        )
    if tag == "sSup":
        base = _omml_child(el, "e")
        sup = _omml_child(el, "sup")
        return "%s^{%s}" % (
            _omml_to_latex(base) if base is not None else "",
            _omml_to_latex(sup) if sup is not None else "",
        )
    if tag == "sSub":
        base = _omml_child(el, "e")
        sub = _omml_child(el, "sub")
        return "%s_{%s}" % (
            _omml_to_latex(base) if base is not None else "",
            _omml_to_latex(sub) if sub is not None else "",
        )
    if tag == "sPre":
        base = _omml_child(el, "e")
        sub = _omml_child(el, "sub")
        sup = _omml_child(el, "sup")
        return "%s_{%s}^{%s}" % (
            _omml_to_latex(base) if base is not None else "",
            _omml_to_latex(sub) if sub is not None else "",
            _omml_to_latex(sup) if sup is not None else "",
        )
    if tag == "rad":
        deg = _omml_child(el, "deg")
        e = _omml_child(el, "e")
        body = _omml_to_latex(e) if e is not None else ""
        d = _omml_to_latex(deg) if deg is not None else ""
        if d.strip():
            return "\\sqrt[%s]{%s}" % (d, body)
        return "\\sqrt{%s}" % body
    if tag == "d":
        e = _omml_child(el, "e")
        return _omml_delim(el, "begChr", "(") + (_omml_to_latex(e) if e is not None else "") + _omml_delim(el, "endChr", ")")
    if tag == "nary":
        pr = _omml_child(el, "naryPr")
        chr_node = pr.find(f"{M_NS}chr") if pr is not None else None
        chr_val = chr_node.get(f"{WORD_NS}val") if chr_node is not None else None
        op = _OMML_NARY_MAP.get(chr_val, "\\int " if not chr_val else _omml_text(chr_val))
        out = op
        sub = _omml_child(el, "sub")
        sup = _omml_child(el, "sup")
        e = _omml_child(el, "e")
        if sub is not None and _omml_to_latex(sub).strip():
            out += "_{%s}" % _omml_to_latex(sub)
        if sup is not None and _omml_to_latex(sup).strip():
            out += "^{%s}" % _omml_to_latex(sup)
        if e is not None:
            out += "{%s}" % _omml_to_latex(e)
        return out
    if tag == "m":
        rows = []
        for mr in el.findall(f"{M_NS}mr"):
            rows.append("&".join(_omml_to_latex(c) for c in mr.findall(f"{M_NS}e")))
        return "\\begin{matrix}%s\\end{matrix}" % "\\\\".join(rows)
    if tag == "bar":
        e = _omml_child(el, "e")
        return "\\overline{%s}" % (_omml_to_latex(e) if e is not None else "")
    if tag == "limLow":
        base = _omml_child(el, "e")
        lim = _omml_child(el, "lim")
        b = _omml_to_latex(base) if base is not None else ""
        below = _omml_to_latex(lim) if lim is not None else ""
        return "%s_{%s}" % (b, below) if below.strip() else b
    if tag == "limUpp":
        base = _omml_child(el, "e")
        lim = _omml_child(el, "lim")
        b = _omml_to_latex(base) if base is not None else ""
        above = _omml_to_latex(lim) if lim is not None else ""
        return "%s^{%s}" % (b, above) if above.strip() else b
    if tag == "func":
        name_el = _omml_child(el, "fName")
        arg_el = _omml_child(el, "e")
        name = _omml_to_latex(name_el) if name_el is not None else ""
        name = _OMML_FUNC_RE.sub(r"\\\1", name)
        arg = _omml_to_latex(arg_el) if arg_el is not None else ""
        if not arg.strip():
            return name
        return "%s{%s}" % (name, arg)
    return "".join(_omml_to_latex(c) for c in el)


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
        text = _para_text_with_math(p).strip()
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
            current["answer_key"] = _strip_latex_delims(m.group(1).strip())
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
        #    gabungkan ke item terakhir dengan newline agar indentasi/spasi/enter
        #    tidak ter-compact (roundtrip export->import akurat).
        if current is not None:
            if current["options"]:
                last_opt = current["options"][-1]
                if text:
                    last_opt["text"] += "\n" + text
                attach_imgs(last_opt, imgs)
            else:
                if text:
                    if current["question_text"]:
                        current["question_text"] += "\n" + text
                    else:
                        current["question_text"] = text
                attach_imgs(current, imgs)
            continue

        # 9) belum ada soal terbuka (misal judul dokumen di baris pertama) -> lewati

    flush()

    # finalisasi is_correct + pastikan struktur konsisten
    # Konversi plain-text docx (dengan \n, tab, markdown link, literal HTML)
    # ke HTML allowlist via _docx_text_to_html agar konsisten dengan AI:
    # literal "<div>" → "&lt;div&gt;" dalam <code>/code-block, hyperlink Word → <a>.
    result = []
    for q in questions:
        answer_letter = q.pop("answer_letter", None)
        answer_key = q.pop("answer_key", None)
        forced_type = q.pop("forced_type", None)
        points = q.pop("points", None)
        result.append({
            "question_text": _docx_text_to_html(q["question_text"]),
            "images": q["images"],
            "forced_type": forced_type,
            "options": [
                {
                    "text": _docx_text_to_html(o["text"]),
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
    sections = (
        db.query(Section)
        .filter(Section.form_id == form.id)
        .order_by(Section.order_index, Section.id)
        .all()
    )
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

    # Batch import menempel di akhir section target lalu geser bawahnya —
    # sama seperti tambah soal satuan (16, bukan 31).
    next_order = _insert_order_for_section(db, form.id, target_section_id, sections, gap=len(parsed))
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


_EXPORT_LETTERS = "ABCDEFGHIJ"


def _export_strip_html(text: str | None) -> str:
    raw = str(text or "")
    had_tags = bool(re.search(r"<[a-zA-Z][^>]*>", raw))
    cleaned = html.unescape(re.sub(r"<[^>]*>", "", raw))
    if not had_tags and re.search(r"<[a-zA-Z][^>]*>", cleaned):
        cleaned = html.unescape(re.sub(r"<[^>]*>", "", cleaned))
    return html.unescape(cleaned).strip()


_CODE_BLOCK_RE = re.compile(
    r'<pre\s+(?P<preattr>[^>]*class="[^"]*ql-(?:syntax|code-block)[^"]*"[^>]*)>(?P<inner2>.*?)</pre>'
    r'|<div\s+class="ql-code-block"(?P<attr2>[^>]*)>(?P<inner3>.*?)</div>',
    re.S | re.I,
)

_CONTAINER_OPEN_RE = re.compile(
    r'<div\s+class="ql-code-block-container"[^>]*>\s*<div\s+class="ql-code-block"(?P<attr>[^>]*)>',
    re.I,
)
_DIV_TAG_RE = re.compile(r"</?div\b[^>]*>", re.I)


def _scan_containers(raw: str) -> list[tuple[int, int, str, str]]:
    """Cari container Quill dengan depth-counting (tahan div bersarang per-baris).

    Kembalikan list (start, end, lang, inner)."""
    out: list[tuple[int, int, str, str]] = []
    for m in _CONTAINER_OPEN_RE.finditer(raw or ""):
        depth = 1
        for t in _DIV_TAG_RE.finditer(raw, m.end()):
            if t.group(0).startswith("</"):
                depth -= 1
            else:
                depth += 1
            if depth == 0:
                end = t.end()
                c = re.match(r"\s*</div>", raw[end:], re.I)
                if c:
                    end += c.end()
                lm = re.search(r'data-language="([\w+#-]+)"', m.group("attr") or "")
                out.append((m.start(), end, (lm.group(1) if lm else "plain"), _export_decode_code_inner(raw[m.end():t.start()])))
                break
    return out


def _export_decode_code_inner(inner: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", inner or "", flags=re.I)
    s = re.sub(r"</div\s*>\s*<div[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s).strip("\n")


def _export_split_lone(gap: str) -> list[tuple[str, str, str]]:
    """Pecah celah tanpa container: `pre.ql-syntax` / lone `div.ql-code-block`."""
    out: list[tuple[str, str, str]] = []
    pos = 0
    for m in _CODE_BLOCK_RE.finditer(gap or ""):
        if m.start() > pos:
            out.append(("rich", "", gap[pos:m.start()]))
        attr = m.group("preattr") or m.group("attr2") or ""
        lm = re.search(r'data-language="([\w+#-]+)"', attr)
        inner = m.group("inner2") or m.group("inner3") or ""
        out.append(("code", (lm.group(1) if lm else "plain"), _export_decode_code_inner(inner)))
        pos = m.end()
    if pos < len(gap or ""):
        out.append(("rich", "", gap[pos:]))
    return out


def _export_split_blocks(raw: str) -> list[tuple[str, str, str]]:
    """Pecah HTML jadi blok `("code", lang, kode)` / `("rich", "", html)`."""
    raw = raw or ""
    out: list[tuple[str, str, str]] = []
    pos = 0
    for start, end, lang, code in sorted(_scan_containers(raw), key=lambda s: s[0]):
        if start < pos:
            continue
        if start > pos:
            out.extend(_export_split_lone(raw[pos:start]))
        out.append(("code", lang, code))
        pos = end
    if pos < len(raw):
        out.extend(_export_split_lone(raw[pos:]))
    if not out:
        return [("rich", "", raw)]
    return [b for b in out if b[0] != "rich" or b[2]]


def _export_add_image(paragraph, blob: bytes, width_in=4.5):
    """Embed gambar ke paragraf docx. Gagal (korup/format aneh) → skip diam-diam."""
    try:
        from docx.shared import Inches
        run = paragraph.add_run()
        run.add_picture(io.BytesIO(blob), width=Inches(width_in))
    except Exception:
        pass


# Formula bisa tersimpan dalam 3 bentuk: `\(...\)`/`\[...\]` (import DOCX),
# `$...$`/`$$...$$` (RichTextEditor/Quill), atau HTML `<math>` (KaTeX export).
# Urutan alternation penting: delimiter 2-char dulu, `\(` sebelum `$`.
_FORMULA_SPLIT_RE = re.compile(
    r"(\\\(.+?\\\)|\\\[.+?\\\]|<math\b[^>]*>.*?</math>|\$\$.+?\$\$|\$.+?\$)",
    re.S,
)


def _export_add_omml(paragraph, src: str, is_latex: bool) -> bool:
    """Konversi LaTeX `\\(...\\)`/`\\[...\\]` atau HTML `<math>` ke OMML `<m:oMath>`

    lalu tempel ke paragraf docx → Word render sebagai formula native (alt+=).
    Gagal (syntax tak dikenal) → False, caller boleh fallback teks biasa.
    """
    try:
        from lxml import etree as ET
        from latex2mathml.converter import convert as latex_to_mathml
        from mathml2omml import convert as mathml_to_omml
        if is_latex:
            mathml = latex_to_mathml(src.strip())
        else:
            mathml = src
        omml_xml = mathml_to_omml(mathml)
        if not omml_xml or "<m:oMath" not in omml_xml:
            return False
        # mathml2omml.output tanpa xmlns:m — bungkus root untuk mendeklare
        # namespace Office Math, lalu ambil elemen oMath-nya.
        ns = M_NS.strip("{}")
        wrapped = ET.fromstring(
            f'<root xmlns:m="{ns}">{omml_xml}</root>'.encode("utf-8")
        )
        paragraph._p.append(wrapped[0])
        return True
    except Exception:
        return False


class _DocxRichParser(_HTMLParser):
    """HTML inline Quill → runs docx berformat (bold/italic/underline/strike/code)."""

    def __init__(self, paragraph):
        super().__init__(convert_charrefs=False)
        self.p = paragraph
        self.stack: list[dict] = []
        self.cur = {"bold": False, "italic": False, "underline": False, "strike": False, "code": False}
        self._seen_block = False

    def _block_break(self):
        if not self._seen_block:
            self._seen_block = True
            return
        if self.p.runs:
            self.p.add_run().add_break()

    def _push(self, key):
        self.stack.append(dict(self.cur))
        self.cur[key] = True

    def handle_starttag(self, tag, attrs):
        t = tag.lower()
        if t in ("strong", "b"):
            self._push("bold")
        elif t in ("em", "i"):
            self._push("italic")
        elif t == "u":
            self._push("underline")
        elif t in ("s", "strike", "del"):
            self._push("strike")
        elif t == "code":
            self._push("code")
        elif t == "br":
            self.p.add_run().add_break()
        elif t == "li":
            self._block_break()
            self.p.add_run("• ")
        elif t in ("p", "div", "h2", "h3", "h4", "blockquote", "ul", "ol", "tr"):
            self._block_break()

    def handle_endtag(self, tag):
        if tag.lower() in ("strong", "b", "em", "i", "u", "s", "strike", "del", "code") and self.stack:
            self.cur = self.stack.pop()

    def handle_data(self, data):
        if not data:
            return
        text = html.unescape(data).replace("\xa0", " ")
        if not text.strip():
            return
        run = self.p.add_run(text)
        self._seen_block = True
        run.bold = self.cur["bold"] or None
        run.italic = self.cur["italic"] or None
        run.underline = self.cur["underline"] or None
        if self.cur["strike"]:
            run.font.strike = True
        if self.cur["code"]:
            run.font.name = "Consolas"


def _export_add_formula_seg(paragraph, seg: str) -> bool:
    """Satu segmen formula → OMML. Kembalikan True bila jadi OMML.

    Validasi delimiter ketat: seg harus berpasangan (`\\(...\\)`, `$$...$$`,
    `$...$`, `<math>…</math>`). Lone `$slot` (tanpa penutup) → False agar
    fallback ke teks biasa — ini bug `$slot` → `slo` yang dilaporkan.
    """
    if seg.startswith("\\("):
        if not seg.endswith("\\)") or len(seg) < 4:
            return False
        tex = seg[2:-2]
        return bool(tex.strip()) and _export_add_omml(paragraph, tex, True)
    if seg.startswith("\\["):
        if not seg.endswith("\\]") or len(seg) < 4:
            return False
        tex = seg[2:-2]
        return bool(tex.strip()) and _export_add_omml(paragraph, tex, True)
    if seg.startswith("$$"):
        if not seg.endswith("$$") or len(seg) < 4:
            return False
        tex = seg[2:-2]
        return bool(tex.strip()) and _export_add_omml(paragraph, tex, True)
    if seg.startswith("$"):
        # $$ sudah ditangani di atas
        if not seg.endswith("$") or len(seg) < 2:
            return False
        tex = seg[1:-1]
        if not tex.strip():
            return False
        # Heuristik: `$...$` rentan tabrakan dengan variabel kode `$slot`.
        # `$slot dan $` (“slot dan ”) tanpa ciri math (\ ^ _ {} =+-*/<>|) → kalimat natural, tolak.
        stripped = tex.strip()
        if " " in stripped and not any(c in stripped for c in "\\^_{}=+-*/<>|"):
            if re.fullmatch(r"[A-Za-z0-9_ ,.\t]+", stripped):
                return False
        return _export_add_omml(paragraph, tex, True)
    if seg.lower().startswith("<math"):
        return _export_add_omml(paragraph, seg, False)
    return False


def _export_add_rich_runs(paragraph, html_chunk: str) -> bool:
    """HTML rich (tanpa code-block) → runs berformat; formula jadi OMML."""
    has_formula = False
    for seg in _FORMULA_SPLIT_RE.split(html_chunk or ""):
        seg = seg or ""
        if not seg:
            continue
        if seg.startswith("\\(") or seg.startswith("\\[") or seg.startswith("$") or seg.lower().startswith("<math"):
            if _export_add_formula_seg(paragraph, seg):
                has_formula = True
            else:
                _DocxRichParser(paragraph).feed(seg)
        else:
            _DocxRichParser(paragraph).feed(seg)
    return has_formula


def _export_add_code_block(doc, lang: str, code: str) -> None:
    """Kode → paragraf monospace + shading abu + label bahasa."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt
    p = doc.add_paragraph()
    if lang and lang != "plain":
        lab = p.add_run(f"{lang}\n")
        lab.font.size = Pt(8)
        lab.bold = True
    lines = (code or "").split("\n") or [""]
    for i, line in enumerate(lines):
        run = p.add_run(("\n" if i else "") + (line or " "))
        run.font.name = "Consolas"
        run.font.size = Pt(9)
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), "F2F2F2")
    pPr.append(shd)


def _export_add_runs(paragraph, raw: str, prefix: str = ""):
    """Tambahkan run teks ke paragraf: rich inline berformat, code-block jadi
    run monospace inline, formula jadi OMML native."""
    from docx.shared import Pt
    if prefix:
        paragraph.add_run(prefix)
    has_formula = False
    for kind, lang, chunk in _export_split_blocks(raw or ""):
        if kind == "code":
            if not chunk.strip():
                continue
            for i, line in enumerate(chunk.split("\n")):
                if i:
                    paragraph.add_run().add_break()
                run = paragraph.add_run(line or " ")
                run.font.name = "Consolas"
                run.font.size = Pt(9)
        else:
            if _export_add_rich_runs(paragraph, chunk):
                has_formula = True
    return has_formula


def _export_write_blocks(doc, raw: str, prefix: str = ""):
    """Tulis HTML ke doc: rich jalan di paragraf bernomor, tiap code-block
    jadi paragraf monospace + shading sendiri (jelas terbaca sebagai kode)."""
    current = doc.add_paragraph()
    if prefix:
        current.add_run(prefix)
    for kind, lang, chunk in _export_split_blocks(raw or ""):
        if kind == "code":
            if chunk.strip():
                _export_add_code_block(doc, lang, chunk)
            current = None
        else:
            if current is None:
                current = doc.add_paragraph()
            _export_add_rich_runs(current, chunk)
    return current or doc.paragraphs[-1]


def _export_add_answer_key(paragraph, raw: str):
    """Tulis baris `Kunci: a;b` — kunci yang berupa LaTeX (mengandung \\
    backslash) jadi OMML native, sisanya plain text. Answer key di DB tanpa
    delimiter `\\(...\\)` (di-strip saat import), jadi deteksi manual."""
    paragraph.add_run("Kunci: ")
    keys = [k.strip() for k in re.split(r"[;\n]+", raw or "") if k.strip()]
    for i, k in enumerate(keys):
        if i:
            paragraph.add_run("; ")
        if "\\" in k:
            if not _export_add_omml(paragraph, k, True):
                paragraph.add_run(k)
        else:
            paragraph.add_run(k)


@router.get("/forms/{form_id}/export/docx")
def export_docx(form: Form = Depends(verify_form_owner), db: Session = Depends(get_db)):
    """Export seluruh soal form ke .docx format template import (round-trip).

    Cermin parser import: nomor `N.`, opsi `A.`-`J.`, `Answer: B` / `A, C`,
    `Kunci: a;b`, `Point: N` (hanya scoring manual). Judul section jadi
    Heading (parser skip heading → aman diimport ulang). Gambar soal/opsi
    di-embed ulang dari disk. Audio tak ikut (docx tak bisa round-trip audio).
    Batasan import berlaku juga di sini: dropdown tanpa kunci & tipe
    non-opsi (password/date/time/file) kembali sebagai essay/MC polos.
    """
    try:
        from docx import Document  # type: ignore
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="python-docx is not installed",
        )

    questions = (
        db.query(Question)
        .options(selectinload(Question.options).selectinload(QuestionOption.images), selectinload(Question.images))
        .filter(Question.form_id == form.id, Question.is_deleted.is_(False))
        .order_by(Question.order_index, Question.id)
        .all()
    )
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Form belum memiliki soal untuk diekspor",
        )
    sections = (
        db.query(Section)
        .filter(Section.form_id == form.id)
        .order_by(Section.order_index, Section.id)
        .all()
    )
    section_title = {s.id: _export_strip_html(s.title) or "Bagian" for s in sections}
    is_manual = form.scoring_mode == ScoringMode.manual

    doc = Document()
    doc.add_heading(f"Soal — {_export_strip_html(form.title) or form.short_code}", level=1)

    last_section = object()
    for n, q in enumerate(questions, 1):
        if q.section_id != last_section:
            last_section = q.section_id
            if q.section_id in section_title:
                doc.add_heading(section_title[q.section_id], level=2)
        _export_write_blocks(doc, q.question_text, prefix=f"{n}. ")
        if is_manual and q.is_scored and isinstance(q.points, int) and 1 <= q.points <= 100:
            doc.add_paragraph(f"Point: {q.points}")
        for img in sorted(q.images, key=lambda i: i.order_index or 0):
            if str(img.path or "").lower().endswith((".mp3", ".wav", ".m4a", ".ogg", ".aac", ".webm")):
                continue
            full = os.path.join(UPLOAD_DIR, (img.path or "").lstrip("/"))
            if os.path.isfile(full):
                with open(full, "rb") as f:
                    _export_add_image(doc.add_paragraph(), f.read())
        opts = sorted(q.options, key=lambda o: o.order_index or 0)
        correct_letters = []
        for i, opt in enumerate(opts):
            letter = _EXPORT_LETTERS[i] if i < len(_EXPORT_LETTERS) else chr(ord("K") + i - 10)
            if opt.is_correct and i < len(_EXPORT_LETTERS):
                correct_letters.append(letter)
            _export_write_blocks(doc, opt.option_text, prefix=f"{letter}. ")
            for img in sorted(opt.images, key=lambda im: im.order_index or 0):
                full = os.path.join(UPLOAD_DIR, (img.path or "").lstrip("/"))
                if os.path.isfile(full):
                    with open(full, "rb") as f:
                        _export_add_image(doc.add_paragraph(), f.read())
        if correct_letters:
            doc.add_paragraph(f"Answer: {', '.join(correct_letters)}")
        elif (q.answer_key or "").strip():
            _export_add_answer_key(doc.add_paragraph(), q.answer_key)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    safe_title = re.sub(r"[^\w\-. ]+", "_", _export_strip_html(form.title)).strip(" ._")[:100] or "soal"
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.docx"'},
    )


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
    latex_sample = os.path.join(os.path.dirname(__file__), "../../../frontend/public/Template_Soal_Quizary_Matematika_LaTeX.docx")
    assert os.path.exists(latex_sample), "contoh docx rumus hilang"
    ldoc = Document(latex_sample)
    p53 = ldoc.paragraphs[53]
    maths53 = [c for c in p53._p if (c.tag.split("}", 1)[1] if "}" in c.tag else c.tag) in ("oMath", "oMathPara")]
    assert len(maths53) == 2, [c.tag for c in p53._p]
    assert _omml_to_latex(maths53[0]) == "\\frac{x^{2}-9}{x-3}", _omml_to_latex(maths53[0])
    assert _omml_to_latex(maths53[1]) == "x\\neq 3", _omml_to_latex(maths53[1])
    p19 = ldoc.paragraphs[19]
    maths19 = [c for c in p19._p if (c.tag.split("}", 1)[1] if "}" in c.tag else c.tag) in ("oMath", "oMathPara")]
    assert _omml_to_latex(maths19[0]) == "\\sin^{2}{(x)}+\\cos^{2}{(x)}=1", _omml_to_latex(maths19[0])
    p26 = ldoc.paragraphs[26]
    maths26 = [c for c in p26._p if (c.tag.split("}", 1)[1] if "}" in c.tag else c.tag) in ("oMath", "oMathPara")]
    assert _omml_to_latex(maths26[0]) == "(\\begin{matrix}2&1\\\\4&3\\end{matrix})", _omml_to_latex(maths26[0])
    p37 = ldoc.paragraphs[37]
    maths37 = [c for c in p37._p if (c.tag.split("}", 1)[1] if "}" in c.tag else c.tag) in ("oMath", "oMathPara")]
    lim37 = _omml_to_latex(maths37[0])
    assert "\\lim_{x\\to 0}" in lim37, lim37
    assert "\\frac{\\sin{(4x)}}{2x}" in lim37, lim37
    p2 = ldoc.paragraphs[2]
    maths2 = [c for c in p2._p if (c.tag.split("}", 1)[1] if "}" in c.tag else c.tag) in ("oMath", "oMathPara")]
    assert _omml_to_latex(maths2[0]) == "\\int _{0}^{1}{(3x^{2}+2x+1)} dx", _omml_to_latex(maths2[0])
    print("ok OMML -> LaTeX")
    items = _extract_docx_items(ldoc)
    parsed = _parse_docx_items(items)
    assert len(parsed) == 17, f"harus 17 soal, dapat {len(parsed)}"
    assert "\\int _{0}^{1}" in parsed[0]["question_text"], parsed[0]["question_text"]
    assert "\\(" in parsed[0]["question_text"] and "\\)" in parsed[0]["question_text"]
    assert all("\\(\\)" not in q["question_text"] for q in parsed), "rumus kosong bocor"
    assert all("\\(\\)" not in o["text"] for q in parsed for o in q["options"]), "rumus kosong bocor di opsi"
    assert any("\\frac" in o["text"] for q in parsed for o in q["options"]), "opsi pecahan hilang"
    print("ok wiring OMML inline")
    q3 = parsed[2]
    assert len(q3["options"]) == 4, [o["text"][:40] for o in q3["options"]]
    assert any("\\tan" in o["text"] for o in q3["options"]), "opsi B hilang/gabung"
    assert [o["is_correct"] for o in q3["options"]] == [True, False, True, True], "kunci A,C,D geser"
    assert _para_text_with_math(ldoc.paragraphs[20]).startswith("B. \\("), _para_text_with_math(ldoc.paragraphs[20])[:60]
    assert "\\(\\alpha\\)" in parsed[1]["question_text"], parsed[1]["question_text"][:200]
    assert "\\(x^{2}-5x+6=0\\) adalah" in parsed[1]["question_text"], parsed[1]["question_text"][:200]
    assert parsed[15]["answer_key"] == "\\frac{11}{15};11/15", parsed[15]["answer_key"]
    assert "\\(" not in (parsed[15]["answer_key"] or ""), "delimiter bocor ke kunci"
    assert "\\lvert" in parsed[13]["options"][0]["text"] and "\\rvert" in parsed[13]["options"][0]["text"], parsed[13]["options"][0]["text"]
    assert "u\\times v" in parsed[7]["question_text"], parsed[7]["question_text"]
    assert "\\nabla f" in parsed[9]["question_text"], parsed[9]["question_text"]
    assert "\\) adalah" in parsed[1]["question_text"], parsed[1]["question_text"][:200]
    assert "\\) dan \\(v=" in parsed[7]["question_text"], parsed[7]["question_text"]
    print("ok rumus lanjutan")
    print("done")
