# Quizary — Form & Quiz Builder

Platform pembuatan form dan quiz berbasis web + mobile. Admin membuat form/quiz, membagikan link, responden mengisi lewat web atau Android, dan hasilnya otomatis di-grade.

Menggabungkan kemudahan form builder (seperti Google Forms) dengan kelengkapan sistem ujian: timer terjadwal, anti-cheat, auto-grading, leaderboard, dan pengalaman gamified untuk mode quiz.

## Struktur Project

```
quizary/
├── backend/     # REST API — FastAPI + MySQL
├── frontend/    # Web app — React + Vite (Tailwind)
├── android/     # Android app — Expo / React Native
├── config/      # Dokumen produk & kontrak (PRD, API contract, dst)
└── .gitignore
```

| Folder | Isi | README |
|---|---|---|
| `backend/` | API, autentikasi, database, auto-grading, import docx, export excel | [backend/README.md](backend/README.md) |
| `frontend/` | Web app: dashboard admin, form builder, halaman publik | [frontend/README.md](frontend/README.md) |
| `android/` | Aplikasi Android (Expo) | [android/README.md](android/README.md) |
| `config/` | `prd.md`, `api-contract.md`, `validation-rules.md`, `requirement-analysist.md` | — |

## Tech Stack

| Bagian | Teknologi |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0, MySQL, Pydantic v2, JWT, Alembic |
| Frontend web | React 19, Vite, Tailwind CSS, React Router, Axios |
| Android | Expo / React Native, expo-router |

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # isi kredensial MySQL
alembic upgrade head    # atau: bash fresh.sh (drop + migrate + seed)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs di `http://localhost:8000/docs`. Instruksi lengkap di [backend/README.md](backend/README.md).

### Frontend web

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:8000/api
npm run dev
```

Instruksi lengkap di [frontend/README.md](frontend/README.md).

### Android

```bash
cd android
npm install
npx expo start
```

## Dokumentasi Produk

Referensi lengkap (source of truth) ada di `config/`:

- `config/prd.md` — product requirement document
- `config/api-contract.md` — spesifikasi API lengkap dengan contoh request/response
- `config/validation-rules.md` — aturan validasi + checklist testing per endpoint
- `config/requirement-analysist.md` — analisis kebutuhan

## Mode Produk

1. **Mode Form/Survey** — pengalaman formal dan minimalis untuk survey, feedback, pendataan.
2. **Mode Quiz** — pengalaman gamified, satu soal per layar, timer, auto-grading, leaderboard, anti-cheat.
