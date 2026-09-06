# Quizary — Form & Quiz Builder

Platform pembuatan form dan quiz berbasis web + mobile. Admin membuat form/quiz, membagikan link, responden mengisi lewat web atau Android, dan hasilnya otomatis di-grade.

Menggabungkan kemudahan form builder (seperti Google Forms) dengan kelengkapan sistem ujian: timer terjadwal, anti-cheat, auto-grading, leaderboard, pengalaman gamified untuk mode quiz, serta bantuan AI untuk pembuatan soal.

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
| Backend | FastAPI, SQLAlchemy 2.0, MySQL, Pydantic v2, JWT, Alembic, Gemini API (AI builder) |
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
3. **Bantuan AI** — buat draf form/quiz dari prompt deskriptif (mis. “20 soal HOTS reading comprehension”) beserta file referensi `docx/pdf/pptx`. AI menyusun section, soal pilihan ganda/isi-an, dan pengaturan dasar untuk direview sebelum disimpan.

## Sorotan Terbaru

Pengembangan beberapa minggu terakhir difokuskan pada pengalaman ujian dan kecepatan:

**Ujian terasa lebih adil dan tenang.** Mode terbatas kini memberi jeda 5 detik dengan alarm lembut saat peserta keluar dari layar ujian, lalu kembali otomatis tanpa perlu proses berulang. Klik kanan atau shortcut seperti `F12` hanya dicegah, tidak langsung dihitung sebagai pelanggaran. Pesan pelanggaran juga sudah dua bahasa dan lebih mudah dipahami — misalnya `window-blur` tampil sebagai "Jendela ujian tidak aktif" — serta status `locked` akan difinalisasi otomatis setelah 5 menit.

**Waktu pengerjaan lebih konsisten.** Jika peserta dikembalikan dari status `locked` atau `cheating` ke `in_progress`, sisa waktunya melanjutkan dari posisi terakhir, bukan mengulang dari awal. Hanya pengiriman yang sudah selesai (`submitted`) yang akan memulai waktu baru saat dibuka kembali.

**Aplikasi terasa lebih cepat.** Beban data di backend dikurangi dari ratusan query menjadi beberapa query terpusat untuk pembukaan soal dan analitik, ditambah indeks database yang lebih tepat untuk pencarian berdasarkan form dan status. Di sisi web, daftar form, editor soal, dan halaman pengerjaan tidak lagi merender ulang semuanya saat mengetik, sehingga tetap lancar bahkan dengan puluhan soal.

**Pembuatan soal dibantu AI.** Dari dashboard, pembuat form cukup menuliskan kebutuhan dalam bahasa sehari-hari — AI akan menyusun draf section, soal, dan pengaturan awal untuk ditinjau. Prosesnya mendukung file referensi dan tetap memberi kontrol penuh sebelum disimpan.

Detail teknis lengkap ada di `frontend/README.md` dan `backend/README.md`.
