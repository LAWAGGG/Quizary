# Quizary API — Backend

REST API untuk platform pembuatan form dan quiz. Melayani dashboard admin (manajemen form/soal, hasil, statistik) dan akses publik (pengisian quiz oleh responden, auto-grading).

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Framework | FastAPI (Python 3.12+) |
| ORM | SQLAlchemy 2.0 |
| Database | MySQL (via PyMySQL) |
| Validasi | Pydantic v2 |
| Auth | JWT (python-jose) |
| Password | bcrypt |
| Migration | Alembic |
| Export | OpenPyXL (.xlsx) |
| Import | python-docx (.docx, termasuk gambar) |

## Struktur Folder

```
backend/
├── app/
│   ├── main.py              # Entrypoint, register semua router + static mount
│   ├── config.py            # Environment variables (.env)
│   ├── database.py          # SQLAlchemy engine + session
│   ├── auth.py              # JWT encode/decode, password hash
│   ├── dependencies.py      # get_current_user, verify_form_owner, get_optional_user
│   ├── utils.py             # Helper: file_url (path → full URL)
│   ├── models/              # 11 tabel database (1 file per entitas)
│   ├── schemas/             # Pydantic request/response per modul
│   ├── services/            # Logika non-routing: grading, points, session_expiry
│   └── routers/             # 8 file router (auth, forms, questions, ...)
├── alembic/                 # Database migrations
├── requirements.txt
├── seed.sql                 # Data awal untuk dev
├── fresh.sh                 # Drop semua tabel + migrate + seed (dev)
├── .env.example
```

## Cara Menjalankan

### 1. Prasyarat

- Python 3.12+
- MySQL server

### 2. Clone & Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Linux/Mac
# atau venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 3. Konfigurasi Database

Buat database MySQL:

```sql
CREATE DATABASE fastapi_quizary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Isi konfigurasi `.env`:

```env
DB_USER=root
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fastapi_quizary
SECRET_KEY=generate-random-secret-here
```

### 4. Migrasi Database

```bash
source venv/bin/activate
alembic upgrade head
```

Kalau belum ada migration, jalankan:

```bash
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

Atau langsung inject via seed:

```bash
mysql -u root -p fastapi_quizary < seed.sql
```

### 5. Jalankan Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server berjalan di `http://localhost:8000`. Dokumentasi interaktif di `http://localhost:8000/docs`.

## Environment Variables

| Variable | Wajib | Default | Keterangan |
|---|---|---|---|
| `DB_USER` | ✅ | — | User MySQL |
| `DB_PASSWORD` | | `""` | Password MySQL |
| `DB_HOST` | ✅ | — | Host MySQL |
| `DB_PORT` | ✅ | — | Port MySQL |
| `DB_NAME` | ✅ | — | Nama database |
| `SECRET_KEY` | ✅ | — | Secret key untuk JWT |

## API Endpoints

### Authentication & Profile

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/register` | — | Registrasi akun baru |
| POST | `/api/login` | — | Login, dapat token |
| POST | `/api/logout` | Bearer | Logout |
| GET | `/api/me` | Bearer | Profile user |
| PUT | `/api/me` | Bearer | Update profile |
| POST | `/api/me/avatar` | Bearer | Upload avatar |

### Forms

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/forms` | Bearer | List form milik user |
| POST | `/api/forms` | Bearer | Buat form baru |
| GET | `/api/forms/{id}` | Bearer | Detail form |
| PUT | `/api/forms/{id}` | Bearer | Update form |
| DELETE | `/api/forms/{id}` | Bearer | Hapus form + semua data terkait |
| PATCH | `/api/forms/{id}/publish` | Bearer | Publish / draft form |
| POST | `/api/forms/{id}/banner` | Bearer | Upload banner form |
| DELETE | `/api/forms/{id}/banner` | Bearer | Hapus banner form |

Pengaturan form: timer, jadwal buka/tutup (`starts_at`, `ends_at`), shuffle soal/opsi, limit submission, leaderboard, mode restricted, show-in-history, reveal score/answers, theme color.

### Sections

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/forms/{id}/sections` | Bearer | List section dalam form |
| POST | `/api/forms/{id}/sections` | Bearer | Tambah section |
| PATCH | `/api/sections/{id}` | Bearer | Update section |
| DELETE | `/api/sections/{id}` | Bearer | Hapus section |
| PATCH | `/api/sections/reorder` | Bearer | Ubah urutan section |

### Questions

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/forms/{id}/questions` | Bearer | List soal dalam form |
| POST | `/api/forms/{id}/questions` | Bearer | Tambah soal baru |
| PUT | `/api/questions/{id}` | Bearer | Update soal |
| DELETE | `/api/questions/{id}` | Bearer | Hapus soal |
| PATCH | `/api/questions/reorder` | Bearer | Ubah urutan soal |

Tipe soal: `multiple_choice`, `checkbox`, `dropdown`, `short_answer`, `essay`, `date`, `time`, `file_upload`.

### Images

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/questions/{id}/image` | Bearer | Tambah gambar ke soal (file atau link) |
| POST | `/api/questions/{id}/option/{option_id}/image` | Bearer | Tambah gambar ke opsi soal |
| POST | `/api/questions/{id}/images` | Bearer | Tambah banyak gambar ke soal |
| POST | `/api/options/{id}/images` | Bearer | Tambah gambar ke opsi |
| DELETE | `/api/images/{id}` | Bearer | Hapus gambar |
| DELETE | `/api/options/{id}/images/{image_id}` | Bearer | Hapus gambar dari opsi |

### Public Access

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/q/{short_code}` | — | Lihat informasi form publik |
| GET | `/api/q/{short_code}/start` | — (opsional) | Cek bisa mulai/ngisi |
| GET | `/api/q/{short_code}/leaderboard` | — | Papan peringkat (jika diaktifkan) |

### Submissions

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/submissions` | — (opsional) | Mulai sesi pengisian |
| POST | `/api/submissions/{id}/answers/{question_id}/file` | — | Upload jawaban file untuk soal `file_upload` |
| PATCH | `/api/submissions/{id}/autosave` | — | Auto-save jawaban |
| POST | `/api/submissions/{id}/tab-exit` | — | Catat keluar tab (anti-cheat) |
| POST | `/api/submissions/{id}/submit` | — | Submit final |
| GET | `/api/submissions/{id}` | — (opsional) | Detail submission + hasil |
| GET | `/api/me/submissions` | Bearer | Riwayat submission user |

Status submission: `in_progress`, `submitted`, `auto_submitted` (timer habis), `cheating` (terdeteksi tab-exit berlebihan).

### Results & Dashboard

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/forms/{id}/results` | Bearer | Daftar submission + skor |
| GET | `/api/forms/{id}/analytics` | Bearer | Statistik (rata-rata, distribusi, dll) |
| GET | `/api/forms/{id}/export/excel` | Bearer | Export Excel (.xlsx) |
| GET | `/api/dashboard/summary` | Bearer | Ringkasan dashboard |

`/dashboard/summary` mengembalikan `submission_trend` per **form** (bukan per hari) — top 10 form dengan submission terbanyak, dipakai chart di dashboard.

```json
{
  "submission_trend": [
    { "form_id": 2, "title": "Quiz Matematika Dasar", "count": 12 }
  ]
}
```

### Import

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/forms/{id}/import/docx` | Bearer | Import soal dari file .docx (termasuk gambar di dalam dokumen) |

Import langsung membuat soal sekaligus menyimpan gambar yang ditemukan di dokumen Word.

## Validasi Input

Semua endpoint dengan request body memiliki validasi Pydantic:

- **String field:** `min_length` + `max_length`
- **Integer field:** `ge` + `le`
- **Enum field:** divalidasi via `@model_validator` (pesan error Bahasa Indonesia)
- **Partial update:** semua field `Optional`, proses dengan `exclude_unset=True`
- **Error response 422:**

```json
{
  "message": "Validasi gagal",
  "errors": [
    {"email": "String should match pattern '...'"},
    {"_schema": "type harus 'form' atau 'quiz'"}
  ]
}
```

## File Storage

File upload (banner, avatar, gambar soal/opsi, jawaban file) disimpan di folder runtime `backend/uploads/` (tidak di-track git):

```
backend/uploads/
├── banners/           ← Form banner
├── avatars/           ← Foto profil user
└── question-images/   ← Gambar soal/opsi + file jawaban
```

Di-mount sebagai static files di `/uploads`. Semua response API mengembalikan **full URL** langsung:

```json
{
  "banner_path": "http://localhost:8000/uploads/banners/abc123.png"
}
```

Frontend tinggal pakai tanpa tambahan prefix.

## Ownership & Keamanan

Setiap akses ke resource form milik user tertentu WAJIB melewati pengecekan kepemilikan:

- `verify_form_owner` → endpoint forms/questions
- `_ensure_owner` → endpoint questions by id
- Seluruh endpoint return **403** jika bukan pemilik
- Auth via JWT Bearer token, divalidasi di tiap request

## Testing

Test script ada di bagian **Section 7** `config/validation-rules.md`. Pola dasar:

```bash
PASS=0; FAIL=0
check() { ... }
R1=$(curl -s -X POST http://localhost:8000/api/endpoint ...)
check "description" "assertion" "$R1"
echo "PASS: $PASS | FAIL: $FAIL"
```

Jalankan test setelah setiap perubahan untuk mastiin gak ada regression.

## Referensi Kontrak API

Spesifikasi lengkap endpoint (request/response) ada di `config/api-contract.md`, aturan validasi dan checklist testing per endpoint di `config/validation-rules.md`.
