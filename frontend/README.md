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

## Anti-Cheat & Fitur Terbaru

* **Sound peringatan** `public/sounds/cheat-alert.mp3` (150K, `preload=auto`, `loop=true`, `volume=1`) — diputar di `src/pages/public/AnswerQuiz.jsx:218` `alertAudioRef` prime `pointerdown` (unlock autoplay), loop infinite selama grace 5 detik (`graceCountdown` `play`), stop saat `clearGrace`/`lockedInfo`/`goToResult`. Timer backend tetap `display_deadline` (WIB).
* **Teks pelanggaran rapi** `src/lib/cheatReason.js` `formatCheatReason(raw,t)` map `left-fullscreen/tab-hidden/window-blur/split-screen` → `violation.*` (`src/locales/id.json:752` `en.json:752`), dipakai di `AnswerQuiz` banner `cheatWarningTitle` + `CheatLockOverlay` `lastViolation` dan `Results` tabel/detail `lastRecorded`. `left-fullscreen` keep, `window-blur` → "Jendela ujian tidak aktif".
* **Block-only** klik kanan / `F12` / `Ctrl+P/U/S` / `Ctrl+Shift+I/J/C` / `print` / `PiP` hanya `preventDefault` (`AnswerQuiz.jsx:649`) tidak `reportTabExit` — curang hanya keluar web beneran (`left-fullscreen/tab-hidden/window-blur/split-screen` guard `fsAvailable`).
* **Fix password** `AnswerQuiz.jsx:304` `fetchSubmission` handle `password` sebagai `answer_text` string (sebelumnya masuk `else` jadi `{ids,text}` → `[object Object]`), draft restore convert object → string.

## Optimasi Frontend (Fase 3)

* `AnswerQuiz` `memo(OptionTile/OtherTile)` + `formPages` IIFE + fallback `formPage || {}` biar 50 soal tidak re-render tiap ketik.
* `FormEdit.jsx:230` `dirty` `useMemo` `JSON.stringify(normalize())` biar tidak `stringify` tiap render saat ketik 100 soal.
* `FormList.jsx:290` debounce 300ms `search` → `debouncedSearch` + `filtered useMemo [forms,debouncedSearch]` + `selectionMode` deps `debouncedSearch`.
* `QuestionBuilder.jsx:597` `memo(QuestionCard/SortableQuestionCard/SortableGroupCard)` dnd-kit GPU `Translate`.
* `Results.jsx:247` `answerByQ/questionGroups` `useMemo [detail]`, `Analytics.jsx:67` `memo(QuestionRow)`.
* `useAutosave.js:128` `flushAll` sequential skip empty + `try/catch` per item (bukan `Promise.all` 30 concurrent → DB overload), `AnswerQuiz.jsx:1169` `handleSubmitAll` `Promise.race 4s` + `409` refresh + `finally setSubmitting(false)` anti hang `cheating→in_progress`.

## Struktur Folder (update)

```
frontend/
├── public/sounds/cheat-alert.mp3 # sound anti-cheat loop
└── src/
    ├── lib/cheatReason.js        # formatCheatReason(raw,t)
    ├── locales/id.json, en.json  # violation.* keys
    └── pages/...
```

## Troubleshooting Anti-Cheat

* Windows key `blur` tanpa keluar fullscreen tetap hitung grace 5s (`stillBlurred=!hasFocus()` + `onFocus` clearGrace). `split-screen` cek `screen.height-innerHeight>120`.
* Refresh keluar fullscreen → `fsAvailable` false jadi tidak langsung `report`, tunggu gesture `pointerdown` baru `fsAvailable=true`.
* `pinToFullscreen` branch `already fullscreen` force clear `graceTimerRef/kioskTimer` + `setKioskLocked(false)` biar tidak perlu 2x update status.