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
| AI Builder | Gemini API (via backend), file referensi `docx/pdf/pptx` |

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
| `/forms/ai` | Buat draf form/quiz dengan AI (prompt + file referensi) |
| `/profile` | Profil user |
| `/my-submissions` | Riwayat submission |

## Autentikasi

- Token JWT disimpan di `localStorage` (`token`, `user`).
- Axios interceptor menyisipkan `Authorization: Bearer <token>` di setiap request.
- Saat response `401` di halaman admin, token dihapus dan redirect ke `/login`. Halaman publik (`/q/`, `/s/`) menangani `401` sendiri agar konteks form tidak hilang.

## Pengalaman Mengerjakan

Halaman pengisian (`/s/:submissionId`) untuk mode terbatas menjaga peserta tetap di layar ujian. Jika peserta keluar dari fullscreen, pindah tab, atau jendela menjadi tidak aktif (misalnya menekan tombol Windows), sistem memberi jeda 5 detik dengan alarm lembut untuk kembali. Jika kembali tepat waktu, ujian lanjut tanpa penalti; jika tidak, sesi akan terkunci dan menunggu keputusan pengawas.

Klik kanan atau shortcut seperti `F12` dan `Ctrl+P` hanya dicegah, tidak langsung dihitung sebagai pelanggaran. Pesan pelanggaran juga lebih jelas dan sudah dua bahasa — di banner ujian maupun di halaman hasil, kode seperti `window-blur` kini tampil sebagai "Jendela ujian tidak aktif".

Perbaikan kecil: isian tipe password kini tetap tampil sebagai teks setelah refresh, tidak lagi menjadi `[object Object]`.

## Performa di Sisi Web

Agar tetap lancar dengan puluhan soal, pembaruan terbaru mengurangi render berulang: pilihan jawaban dan kartu soal hanya diperbarui saat datanya berubah, pemeriksaan perubahan di editor form di-cache, pencarian di daftar form diberi jeda sesaat, serta penyimpanan otomatis jawaban dilakukan berurutan dengan batas waktu. Hasilnya, mengetik, menggulir, atau drag-and-drop soal tetap responsif bahkan pada perangkat dengan spesifikasi terbatas.

## Bantuan AI

Halaman `Buat dengan AI` (`/forms/ai`) membantu menyusun draf awal dari instruksi berbahasa sehari-hari. Cukup tulis kebutuhan soal — misalnya jumlah soal, tipe, atau tema — dan tambahkan file `docx/pdf/pptx` sebagai referensi jika ada. Sistem menampilkan pratinjau section, soal, dan pengaturan untuk ditinjau sebelum disimpan. Kuota harian ditampilkan di atas form dan draf yang dihasilkan tetap bisa diedit sebelum disimpan.

## Struktur Folder

```
frontend/
├── public/sounds/cheat-alert.mp3 # audio alarm mode terbatas
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
    ├── components/           # auth, layout, ui (Button, Modal, RichTextEditor, dst)
    ├── context/              # AuthContext, ThemeContext, ToastContext
    ├── hooks/                # useAutosave (penyimpanan berurutan), useTheme, dll
    ├── lib/                  # sanitize, theme, cheatReason (format pesan pelanggaran)
    ├── locales/              # id.json / en.json (termasuk kunci violation.*)
    └── pages/
        ├── auth/             # Login, Register
        ├── dashboard/        # Dashboard
        ├── forms/            # FormList (pencarian debounce), FormEdit, QuestionBuilder
        ├── profile/          # Profile, MySubmissions
        ├── public/           # FormLanding, AnswerQuiz (alarm + grace), QuizResult
        └── results/          # Results, Analytics (pengelompokan soal di-cache)
```

## Catatan Mode Terbatas

Mode terbatas mengandalkan fullscreen browser. Jika peserta menekan tombol Windows atau membagi layar (split-screen), sistem tetap menganggapnya keluar dari ujian. Refresh halaman akan keluar dari fullscreen sejenak — cukup ketuk lagi di area ujian untuk kembali. Tombol "Lock again & continue" juga akan membersihkan status secara langsung jika sudah kembali ke fullscreen.