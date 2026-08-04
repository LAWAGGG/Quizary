# Validation & Testing Standard — Backend API

Dokumen ini adalah acuan wajib saat **membuat route API baru**. Setiap route baru harus:
1. Memiliki **schema validasi** (Pydantic) sesuai tabel di bawah
2. Memiliki **test coverage** sesuai standar di bagian Testing

---

## 1. Template Pembuatan Route Baru

Setiap route WAJIB mengikuti pola ini:

### Schema (Pydantic)

```python
class MyRequest(BaseModel):
    field_str: str = Field(min_length=1, max_length=100)
    field_int: int = Field(ge=0, le=999)
    field_enum: str = "default"

    @model_validator(mode="after")
    def validate_cross_field(self):
        if "field_enum" in self.model_fields_set and self.field_enum not in ("a", "b"):
            raise ValueError("field_enum harus 'a' atau 'b'")
        return self
```

### Router

```python
@router.get("/path", response_model=ResponseSchema)
def get_handler(param: str = Query(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ...

@router.post("/path", status_code=201, response_model=ResponseSchema)
def create_handler(body: MyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ...
```

### Aturan
- **String:** selalu pakai `Field(min_length=..., max_length=...)`
- **Integer:** selalu pakai `Field(ge=..., le=...)`
- **Enum:** validasi lewat `@model_validator`
- **Partial update:** semua field `Optional`, pakai `model_dump(exclude_unset=True)`
- **Ownership:** setiap akses ke resource milik user tertentu WAJIB dicek
- **Error message:** pakai Bahasa Indonesia untuk pesan yang tampil ke user

---

## 2. Daftar Validasi Per Endpoint

### 2.1 Authentication

#### `POST /api/register`
| Field | Rule | Keterangan |
|---|---|---|
| `name` | `string(1-100)` | Wajib |
| `email` | `string(5-150)`, format email valid | Regex: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` |
| `password` | `string(8-255)` | Wajib |
| `password_confirmation` | `string` | Harus sama dengan `password` |

**Source:** `schemas/auth.py:RegisterRequest`

#### `POST /api/login`
| Field | Rule | Keterangan |
|---|---|---|
| `email` | `string(5-150)`, format email valid | Regex sama |
| `password` | `string(min=1)` | Wajib |

**Source:** `schemas/auth.py:LoginRequest`

### 2.2 Forms

#### `POST /api/forms`
| Field | Rule |
|---|---|
| `title` | `string(1-150)` — wajib |
| `description` | `string?` |
| `type` | `"form"` / `"quiz"` — default `"form"` |
| `is_public` | `boolean` — default `true` |
| `require_login` | `boolean` — default `false` |
| `submission_limit` | `"unlimited"` / `"once"` — default `"unlimited"` |

**Source:** `schemas/form.py:FormCreate`

#### `PUT /api/forms/{form_id}`
Semua opsional (partial update). Field tambahan:
| Field | Rule |
|---|---|
| `theme_color` | hex `#RRGGBB` — regex: `^#[0-9A-Fa-f]{6}$` |
| `timer_seconds` | `int(30-86400)` |
| `starts_at` / `ends_at` | ISO 8601 UTC, `starts_at < ends_at` |
| `status` | `"draft"` / `"published"` / `"closed"` |
| `shuffle_questions` / `shuffle_options` | `boolean` |
| `show_leaderboard` / `is_restricted` | `boolean` — `is_restricted` hanya relevan untuk quiz |

**Rantai setting (auto-coerce):** `is_restricted=true` → `submission_limit="once"` → `require_login=true`. Nilai ter-coerce tersimpan di DB (bukan sekadar validasi). Berlaku di `POST /forms` & `PUT /forms/{id}`.

**Source:** `schemas/form.py:FormCreate`, `schemas/form.py:FormUpdate`, `routers/forms.py:_apply_setting_chain`

#### `PATCH /api/forms/{form_id}/publish`
| Field | Rule |
|---|---|
| `status` | `"published"` / `"draft"` |

**Business rule:** Jika `published`, form harus punya ≥1 soal.

**Source:** `schemas/form.py:FormPublishRequest`, `routers/forms.py:publish_form`

#### `GET /api/forms`
| Query Param | Rule |
|---|---|
| `status` | `string?` — filter |
| `type` | `string?` — filter |
| `page` | `int(>=1)` — default 1 |
| `per_page` | `int(1-100)` — default 10 |

### 2.3 Questions

#### `POST /api/forms/{form_id}/questions`
| Field | Rule |
|---|---|
| `type` | `"multiple_choice"` / `"checkbox"` / `"short_answer"` / `"essay"` |
| `question_text` | `string(min=1)` |
| `points` | `int(0-999)` — default 1 |
| `is_required` | `boolean` — default `true` |
| `options` | `list` — default `[]` |

**Validasi khusus:**
- `multiple_choice` / `checkbox` → `options` ≥1 item
- `short_answer` / `essay` → `options` = `[]`

**Option:**
| Field | Rule |
|---|---|
| `option_text` | `string(min=1)` |
| `is_correct` | `boolean` — default `false` |

**Source:** `schemas/question.py:QuestionCreate`, `schemas/question.py:OptionCreate`

#### `PUT /api/questions/{question_id}`
Semua opsional. Sama seperti create, plus:
- Option dengan `id` → update existing
- Option tanpa `id` → create baru
- Option di DB tapi tidak di payload → dihapus

**Source:** `schemas/question.py:QuestionUpdate`

#### `PATCH /api/questions/reorder`
| Field | Rule |
|---|---|
| `form_id` | `int` |
| `orders` | `list(min=1)` — array of `{id, order_index(>=0)}` |

**Source:** `schemas/question.py:ReorderRequest`

### 2.4 Ownership & Authorization

| Endpoint | Mekanisme |
|---|---|
| `GET/PUT/DELETE /api/forms/{form_id}` | `verify_form_owner` → 403 |
| `PATCH /api/forms/{form_id}/publish` | `verify_form_owner` → 403 |
| `GET/POST /api/forms/{form_id}/questions` | `verify_form_owner` → 403 |
| `PUT/DELETE /api/questions/{id}` | `_ensure_owner` → 403 |
| `PATCH /api/questions/reorder` | inline check → 403 |

---

## 3. Standard Testing Checklist — Wajib untuk Setiap Route Baru

Setiap kali selesai membuat route API baru, WAJIB menjalankan test berikut sebelum dianggap selesai:

### 3.1 Status Code Test (6 kategori)

Gunakan pola `curl` sederhana. Template:

```python
PASS=0; FAIL=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if echo "$actual" | python3 -c "
import sys,json; d = json.load(sys.stdin); detail = d.get('detail', d)
$expected
" 2>/dev/null; then
    PASS=$((PASS+1)); echo "  ✅ $desc"
  else
    FAIL=$((FAIL+1))
    local msg=$(echo "$actual" | python3 -c "
import sys,json; d = json.load(sys.stdin)
if isinstance(d.get('detail'), list): print(d['detail'][0]['msg'])
elif isinstance(d.get('detail'), str): print(d['detail'])
else: print(str(d)[:120])" 2>/dev/null)
    echo "  ❌ $desc — got: $msg"
  fi
}
```

#### Wajib di-test untuk setiap route:

| # | Kategori | Yang Diuji | Assertion |
|---|---|---|---|
| 1 | **Success** | Input valid → response 200/201 | `d['id'] > 0` / `d['message']` |
| 2 | **Validation error** | Field wajib kosong / enum salah / pattern salah → 422 | `isinstance(detail, list)` dan cek `msg` |
| 3 | **Auth error** | Tanpa token / token invalid → 401 | `'Not authenticated' in str(detail)` |
| 4 | **Not found** | ID tidak ada di DB → 404 | `'tidak ditemukan' in str(detail)` atau `'not found'` |
| 5 | **Forbidden/Ownership** | Akses resource milik user lain → 403 | `'not the owner' in str(detail)` atau `'bukan pemilik'` |
| 6 | **Conflict** | Duplikat data → 409 | `'sudah' in str(detail)` |

### 3.2 Business Rule Test

Setiap business logic non-trivial WAJIB di-test:

| Business Rule | Test |
|---|---|
| Publish butuh ≥1 soal | Publish form kosong → 422 |
| Convert MC→essay | Update type+options[] → options terhapus |
| Reorder | Order berubah sesuai payload |
| Short_code unique | Auto-generate, tidak bentrok |
| Partial update | Update 1 field → field lain tidak berubah |
| Soal wajib (FR-10) | Submit dengan `is_required=true` belum dijawab → 422; jawab semua → 200 |
| Soal wajib + auto-submit | Waktu habis & soal wajib kosong → tetap auto-submit 200 (bukan 422) |
| require_login (server-side) | POST /submissions tanpa token untuk form `require_login=true` → 401 |
| Identitas otomatis | POST /submissions dengan token (tanpa nama) → `respondent_name`/`email` dari akun |
| Resume claim session | Session anonim (user_id NULL) di-resume saat login → `user_id` terisi |
| Jawaban benar bocor (FR-34) | GET /submissions/{id} status `in_progress` → `is_correct`/`score` = null |
| Rantai `is_restricted` (chain) | PUT `is_restricted=true` → respons `submission_limit="once"` & `require_login=true` |
| Rantai `once` (chain) | PUT `submission_limit="once"` → respons `require_login=true` |
| once + login (server-side) | POST /submissions tanpa token untuk form `submission_limit="once"` → 401 |
| Anti-cheat tab-exit (threshold) | `POST /submissions/{id}/tab-exit` ×2 → `warnings_left` turun; ×3 → status `cheating`, score `0` |
| Anti-cheat non-quiz/off | `tab-exit` pada form form/`is_restricted=false` → 403 |
| Leaderboard gating | `GET /q/{code}/leaderboard` saat `show_leaderboard=false` → 404 |
| Leaderboard exclude cheating | Submission `cheating` tidak muncul di daftar leaderboard |
| Leaderboard own rank | `?submission_id=` → respons punya `own.{rank, score, total}` |

### 3.3 Edge Case Test

| Edge Case | Test |
|---|---|
| Empty string | `""` → 422 |
| Boundary min | `timer_seconds=30` → 200, `timer_seconds=29` → 422 |
| Boundary max | `timer_seconds=86400` → 200, `timer_seconds=86401` → 422 |
| Special characters | `title` berisi `<>/"` → 200 (harus diterima) |
| Very long input | `title` 150 chars → 200, 151 chars → 422 |
| Non-existent ID | ID `99999` → 404 |
| Invalid token | `Bearer invalid123` → 401 |
| Expired/closed form | (sesuai konteks) |

---

## 4. File Storage

### Lokasi

```
backend/uploads/
├── banners/              ← Banner form (jpg, png, gif, webp)
└── question-images/      ← Gambar soal/opsi
```

Semua file disimpan secara lokal di `backend/uploads/`. Di-mount sebagai static files di `/uploads` oleh FastAPI.

### Format URL Response

Semua response API yang mengembalikan `banner_path`, `avatar`, atau `path` (image) mengembalikan **full URL**:

```
http://localhost:8000/uploads/banners/abc123.png
http://localhost:8000/uploads/question-images/def456.jpg
```

Frontend tinggal pakai langsung tanpa tambahan prefix.

### Helper

```python
from app.utils import file_url

def file_url(request: Request, path: str | None) -> str | None:
    if not path:
        return None
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{path.lstrip('/')}"
```

### Upload Endpoint Behavior

| Endpoint | Storage | Response Field |
|---|---|---|
| `POST /forms/{id}/banner` | `uploads/banners/` | `banner_path` (full URL) |
| `POST /questions/{id}/images` | `uploads/question-images/` | `path` (full URL) |
| `POST /options/{id}/images` | `uploads/question-images/` | `path` (full URL) |

### Catatan
- Gunakan `uuid4().hex` untuk nama file agar unik
- Ekstensi yang diizinkan: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- File upload via `multipart/form-data`; untuk link eksternal gunakan field `path`
- Di DB disimpan path relatif (`banners/abc.png`), di API dikonversi ke full URL

---

## 5. Konvensi Response Status Code

| Status | Arti | Format |
|---|---|---|
| `200` | Success | `{"message": "...", ...}` |
| `201` | Created | `{"id": ..., ...}` |
| `400` | Bad Request | `{"detail": "..."}` |
| `401` | Unauthorized | `{"detail": "Not authenticated"}` |
| `403` | Forbidden | `{"detail": "Anda bukan pemilik form ini"}` |
| `404` | Not Found | `{"detail": "Form tidak ditemukan"}` |
| `409` | Conflict | `{"detail": "Email sudah terdaftar"}` |
| `422` | Validation Error | `{"detail": [{"type": "...", "loc": [...], "msg": "...", "ctx": {...}}]}` |

### Aturan pesan error:
- **422:** Otomatis dari Pydantic (English). Pesan custom di `model_validator` pakai **Bahasa Indonesia**
- **401/403/404/409:** `detail` berupa **string** (bukan list), pakai Bahasa Indonesia
- **Success:** Response body sesuai `api-contract.md`

---

## 6. Aturan Global (Wajib)

1. **String fields:** selalu `min_length` + `max_length` via `Field()`
2. **Integer fields:** selalu `ge` + `le` via `Field()`
3. **Enum fields:** validasi lewat `@model_validator(mode="after")` dengan pesan Bahasa Indonesia
4. **Partial update:** `Optional` fields + `model_dump(exclude_unset=True)` di handler
5. **Ownership:** WAJIB dicek di setiap akses ke resource spesifik
6. **Error message user-facing:** Bahasa Indonesia
7. **ID fields:** `int`, auto-increment di DB
8. **Timestamp:** ISO 8601 UTC (`2026-07-24T10:00:00Z`)
9. **Pagination:** `page` (≥1) + `per_page` (1-100), response berisi `meta: {total, page, per_page}`
10. **Short_code:** generate unik (`secrets.token_urlsafe`), loop sampai unik

---

## 7. Contoh Test Lengkap (Copy-paste template)

```bash
# === TEMPLATE TEST UNTUK ROUTE BARU ===
PASS=0; FAIL=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if echo "$actual" | python3 -c "import sys,json;d=json.load(sys.stdin);detail=d.get('detail',d);$expected" 2>/dev/null; then
    PASS=$((PASS+1)); echo "  ✅ $desc"
  else
    FAIL=$((FAIL+1))
    local msg=$(echo "$actual" | python3 -c "
import sys,json;d=json.load(sys.stdin)
if isinstance(d.get('detail'),list): print(d['detail'][0]['msg'])
elif isinstance(d.get('detail'),str): print(d['detail'])
else: print(str(d)[:120])" 2>/dev/null)
    echo "  ❌ $desc — got: $msg"
  fi
}

# 1. SUCCESS
R1=$(curl -s -X POST http://localhost:8000/api/endpoint ...)
check "description — success" "d['id'] > 0" "$R1"

# 2. VALIDATION ERROR
R2=$(curl -s -X POST http://localhost:8000/api/endpoint -d '{"bad":"data"}')
check "description — validation error (422)" "isinstance(detail,list)" "$R2"

# 3. AUTH ERROR
R3=$(curl -s -X POST http://localhost:8000/api/endpoint ...)
check "description — no auth (401)" "'Not authenticated' in str(detail)" "$R3"

# 4. NOT FOUND
R4=$(curl -s http://localhost:8000/api/endpoint/99999 ...)
check "description — not found (404)" "'not found' in str(detail).lower()" "$R4"

echo "PASS: $PASS | FAIL: $FAIL"
```
