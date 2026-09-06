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

## Update Terbaru (Sep 2026)

Perubahan besar yang belum masuk `config/` — sudah live di `main`:

**Anti-cheat & UX:**
* `is_restricted` fullscreen + grace 5 detik loop sound `frontend/public/sounds/cheat-alert.mp3` (`/sounds/cheat-alert.mp3`, `loop=true`, prime `pointerdown` sebelum `visibilitychange` karena autoplay policy). Sound infinite selama grace, stop saat balik/kelock. Klik kanan / `F12` / `Ctrl+P/U/S` / `Ctrl+Shift+I/J/C` hanya diblok (`preventDefault`) tidak hitung curang — curang hanya `left-fullscreen` / `tab-hidden` / `window-blur` (termasuk tombol Windows) / `split-screen`.
* Teks pelanggaran rapi bilingual via `frontend/src/lib/cheatReason.js` (`formatCheatReason`) + `violation` keys `id.json/en.json` (`window-blur` → "Jendela ujian tidak aktif" bukan raw code). `locked` 5 menit auto-finalize sweep.
* Timer preserve: `locked/cheating → in_progress` pertahankan `started_at` (sisa waktu saat ter-lock) + `tab_exit_count=0`, `submitted → in_progress` baru reset `now` (`backend/app/routers/results.py:180`).
* Double-lock refresh fix: `fetchSubmission`/`handleRefresh` clear `kioskLocked`+`graceTimer`+audio saat `in_progress`, `grace` guard `fsAvailable`, `pinToFullscreen` force clear saat sudah fullscreen.

**Performansi (Fase 1 & 2 & 3):**
* Backend N+1 → 3 query: `session_expiry.py:76` bulk preload, `submissions.py:262` `selectinload(Question.options.images)` + bulk `SubmissionOptionOrder`, `results.py:268` analytics preload, `questions.py:112` preload `list_questions`. `locked→cheating` skip `grade_submission` heavy.
* Index komposit migrasi `f1527199e451` (`alembic upgrade head`): `questions(form_id,is_deleted)/(section/group)`, `submissions(form_id,status)/(form_id,status,user_id)/(ip_address)`, `answers(question_id)`, `forms(user_id,status/type/category)` — `WHERE form_id+status+is_deleted` dari scan → index.
* Frontend render: `AnswerQuiz` `memo(OptionTile/OtherTile)` + `formPages` IIFE, `FormEdit` `dirty useMemo`, `FormList` debounce 300ms `debouncedSearch`, `QuestionBuilder` `memo(QuestionCard/Sortable*)`, `Results` `questionGroups useMemo`, `Analytics` `QuestionRow memo`. `useAutosave flushAll` sequential + `handleSubmitAll` `Promise.race 4s` anti-hang.
* Bug `password` `[object Object]` setelah refresh → `AnswerQuiz.jsx:304` `fetchSubmission` handle `password` sebagai `answer_text` string + draft restore convert `{ids,text}` → string.
