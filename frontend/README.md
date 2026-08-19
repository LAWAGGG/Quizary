# Quizary — Frontend Web

Web app untuk platform Quizary. Menyediakan dashboard admin (manajemen form/soal, hasil, statistik) dan halaman publik (landing form, pengisian quiz, hasil). Terhubung ke API di [backend/README.md](../backend/README.md).

## Tech Stack

| Kategori | Teknologi |
|---|---|
| Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS 3 (dark mode via class), framer-motion |
| Routing | React Router v7 |
| HTTP | Axios (interceptor token + auto-logout) |
| Drag & drop | @dnd-kit (reorder soal/section) |
| Editor rich text | Quill + highlight.js |
| Lainnya | qrcode.react, lucide-react |

## Setup

```bash
cd frontend
npm install
npm run dev
```

App berjalan di `http://localhost:5173`.

### Konfigurasi API

Buat file `.env` di root frontend:

```env
VITE_API_URL=http://localhost:8000/api
```

`VITE_API_URL` wajib benar agar semua request (login, form, submission) terhubung ke backend. Tanpa nilai, default ke `http://localhost:8000/api`.

## Scripts

| Command | Fungsi |
|---|---|
| `npm run dev` | Jalankan dev server (Vite HMR) |
| `npm run build` | Build production ke `dist/` |
| `npm run preview` | Preview hasil build |
| `npm run lint` | Lint dengan Oxlint |

## Routes

### Publik (tanpa login)

| Path | Halaman |
|---|---|
| `/login` | Login |
| `/register` | Registrasi |
| `/q/:shortCode` | Landing form publik |
| `/s/:submissionId` | Pengisian form/quiz |
| `/s/:submissionId/result` | Hasil quiz |

### Admin (perlu login)

| Path | Halaman |
|---|---|
| `/` | Dashboard (ringkasan, form terbaru, tren submission per form) |
| `/forms` | Daftar form milik user |
| `/forms/new` | Buat form baru |
| `/forms/:formId` | Edit pengaturan form |
| `/forms/:formId/questions` | Builder soal (drag & drop, sections) |
| `/forms/:formId/results` | Hasil & export |
| `/forms/:formId/analytics` | Statistik & analitik |
| `/profile` | Profil user |
| `/my-submissions` | Riwayat submission |

## Struktur Folder

```
frontend/
├── index.html
├── package.json
├── tailwind.config.js        # Theme: warna primary #6C5CE7, font Instrument Sans/Sora
├── vite.config.js
└── src/
    ├── main.jsx              # Entrypoint
    ├── App.jsx               # Routing + providers
    ├── index.css
    ├── api/client.js         # Axios instance (baseURL VITE_API_URL, token interceptor)
    ├── assets/
    ├── components/
    │   ├── auth/             # AuthShell
    │   ├── layout/           # DashboardLayout
    │   └── ui/               # Button, Modal, Input, RichTextEditor, SectionManager, dst
    ├── context/              # AuthContext, ThemeContext, ToastContext
    ├── hooks/                # useAuth, useTheme, useToast, useAutosave
    ├── lib/                  # sanitize, theme
    └── pages/
        ├── auth/             # Login, Register
        ├── dashboard/        # Dashboard
        ├── forms/            # FormList, FormCreate, FormEdit, QuestionBuilder
        ├── profile/          # Profile, MySubmissions
        ├── public/           # FormLanding, AnswerQuiz, QuizResult
        └── results/          # Results, Analytics
```

## Autentikasi

- Token JWT disimpan di `localStorage` (`token`, `user`).
- Axios interceptor menyisipkan `Authorization: Bearer <token>` di setiap request.
- Saat response `401` di halaman admin, token dihapus dan redirect ke `/login`. Halaman publik (`/q/`, `/s/`) menangani `401` sendiri agar konteks form tidak hilang.