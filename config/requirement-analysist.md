# Requirement Analysis
## Quizary — Form & Quiz Maker Platform (Assessment System)

**Versi Dokumen:** 2.0
**Status:** Active — Acuan Dasar Pengembangan
**Tech Stack:** Backend FastAPI (Python) · Frontend React
**Konteks:** Project Kompetisi LKSN — Bidang Web Technologies

---

## 1. Pendahuluan

### 1.1 Latar Belakang
Kebutuhan akan sistem pembuatan form dan quiz digital yang tidak hanya berfungsi sebagai form builder umum (seperti Google Forms), tetapi juga mampu menangani kebutuhan ujian formal — meliputi kontrol waktu berbasis jadwal, penilaian otomatis, dan mekanisme anti-kecurangan. Sistem ini dibangun untuk mengakomodasi dua kebutuhan sekaligus: pengumpulan data survey biasa, dan pelaksanaan ujian/asesmen digital yang terstruktur, dengan pengalaman pengerjaan quiz yang hidup di sisi responden.

### 1.2 Tujuan
Dokumen ini disusun untuk:
1. Mendefinisikan kebutuhan fungsional dan non-fungsional sistem secara terstruktur
2. Menjadi acuan dasar dalam setiap tahap pengembangan (desain database, backend, frontend, testing) — **selaras dengan tech stack yang dipilih** (FastAPI + React), bukan asumsi generik
3. Meminimalkan ambiguitas dan perubahan arah pengembangan di tengah jalan
4. Menjadi dokumentasi pendukung untuk keperluan presentasi/penilaian kompetisi

### 1.3 Ruang Lingkup
Sistem mencakup:
- Pembuatan form/quiz oleh admin (termasuk import soal otomatis)
- Distribusi form melalui short link dan QR code
- Pengisian form/quiz oleh responden/peserta
- Penilaian otomatis dan pelaporan hasil
- Manajemen pengguna dan hak akses

Sistem **tidak mencakup**:
- Integrasi pembayaran/monetisasi
- Video conference atau pengawasan ujian berbasis kamera (proctoring visual)
- Sistem manajemen pembelajaran (LMS) secara penuh (materi belajar, kelas, dsb.)
- Live multiplayer session terkontrol host (bukan seperti mode "host game" Kahoot) — sistem ini asynchronous per peserta dalam jendela waktu bersama

### 1.4 Definisi, Istilah, dan Singkatan

| Istilah | Definisi |
|---|---|
| Form | Kumpulan pertanyaan tanpa penilaian otomatis (survey) |
| Quiz | Kumpulan pertanyaan dengan penilaian otomatis dan kontrol waktu |
| Responden | Pengguna yang mengisi form/quiz |
| Admin | Pengguna yang membuat dan mengelola form/quiz |
| Submission | Satu kali pengisian form oleh responden |
| Shuffle | Pengacakan urutan soal/opsi jawaban |
| Auto-grading | Penilaian otomatis oleh sistem tanpa intervensi manual |
| Short link | URL pendek pengganti URL asli form untuk kemudahan berbagi |
| Schema (Pydantic) | Definisi struktur data untuk validasi request/response di FastAPI, terpisah dari model database |
| Model (SQLAlchemy) | Representasi tabel database dalam bentuk class Python, dipetakan lewat ORM |

### 1.5 Referensi
Dokumen ini disusun berdasarkan hasil analisis kebutuhan fitur, struktur database (10 tabel), `api-contract.md`, dan `prd-quizary.md` yang telah disusun pada tahap perencanaan sebelumnya. Keempatnya saling melengkapi dan **tidak boleh saling bertentangan** — kalau ditemukan ketidaksesuaian, dokumen ini (requirement analysis) menjelaskan **kenapa**, `prd-quizary.md` menjelaskan **perilaku produk & UI**, `api-contract.md` menjelaskan **kontrak teknis endpoint**.

---

## 2. Deskripsi Umum Sistem

### 2.1 Perspektif Produk
Sistem berbentuk aplikasi web responsif (dan companion Android untuk sisi responden) yang terdiri dari dua sisi utama:
- **Sisi Admin** — dashboard untuk membuat, mengatur, membagikan, dan menganalisis form/quiz
- **Sisi Responden** — antarmuka publik untuk mengakses dan mengisi form/quiz melalui link atau QR code

Secara teknis, sistem berbentuk **SPA (Single Page Application) React** yang mengonsumsi **REST API FastAPI** sepenuhnya lewat HTTP — tidak ada server-side rendering dari backend, seluruh tampilan dirender di sisi klien.

### 2.2 Fungsi Produk (Ringkasan)
1. Pembuatan form/quiz dengan berbagai tipe soal
2. Import soal otomatis dari dokumen
3. Distribusi via short link & QR code
4. Kontrol waktu berbasis jadwal (bukan berbasis waktu buka halaman)
5. Auto-save jawaban
6. Penilaian otomatis & pelaporan hasil
7. Kustomisasi tampilan
8. Manajemen pengguna berbasis role
9. Mekanisme keamanan anti-kecurangan

### 2.3 Karakteristik Pengguna

| Tipe Pengguna | Deskripsi | Hak Akses |
|---|---|---|
| **Admin** | Guru/pembuat form, umumnya paham dasar teknologi | Membuat, mengedit, menghapus, mempublikasikan form; melihat hasil & statistik |
| **Responden (terdaftar)** | Pengguna dengan akun, mengisi form yang mewajibkan login | Mengisi form, melihat hasil submission miliknya sendiri |
| **Responden (anonim)** | Pengguna tanpa akun, mengisi form publik | Mengisi form yang tidak mewajibkan login |

### 2.4 Batasan Sistem (Constraints)
- Sistem berjalan berbasis web, memerlukan koneksi internet aktif untuk sinkronisasi auto-save dan submit
- Import soal terbatas pada format template yang telah ditentukan (tidak mendukung parsing bebas/format sembarangan)
- Shuffle dan validasi limit submit dijalankan di sisi backend (FastAPI), bukan hanya validasi sisi klien (React) — agar tidak mudah dimanipulasi lewat request langsung ke API
- Satu submission terikat pada satu form dan (opsional) satu user/IP, tidak mendukung multi-attempt kecuali `submission_limit` diatur `unlimited`
- Validasi request/response sepenuhnya bergantung pada Pydantic schema di FastAPI — field yang tidak didefinisikan di schema otomatis ditolak/diabaikan, ini jadi lapisan keamanan tambahan di luar validasi manual

### 2.5 Asumsi dan Ketergantungan
- Diasumsikan admin memahami format template import soal yang disediakan sistem
- Diasumsikan waktu server dan waktu klien memiliki toleransi selisih kecil (untuk keperluan validasi timer), sinkronisasi waktu tetap mengacu ke waktu server (dihitung di FastAPI, bukan `Date.now()` di React)
- Sistem bergantung pada library pihak ketiga untuk generate QR Code (`qrcode` di Python atau `qrcode.react` di frontend — lihat Section 8.2 untuk keputusan penempatan logic ini)

---

## 3. Kebutuhan Fungsional (Functional Requirements)

Setiap kebutuhan diberi kode unik (FR-xx). Kolom **Implementasi Teknis** ditambahkan di versi ini untuk menjelaskan bagaimana requirement dipenuhi dengan tech stack yang dipilih.

### 3.1 Modul Autentikasi & Manajemen Pengguna

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-01 | Registrasi akun | Pengguna baru dapat mendaftar dengan nama, email, dan password | `POST /register`, password di-hash pakai `passlib` (bcrypt) sebelum disimpan lewat SQLAlchemy model `User` |
| FR-02 | Login/Logout | Pengguna dapat masuk dan keluar dari sistem | `POST /login` menghasilkan JWT (`python-jose`), disimpan di frontend lewat cookie httpOnly atau localStorage (lihat Section 8.3 untuk keputusan) |
| FR-03 | Role pengguna | Sistem membedakan hak akses Admin dan User berdasarkan kolom `role` | Kolom `role` di model `User`, dicek lewat FastAPI dependency (`Depends(require_role("admin"))`) |
| FR-04 | Kepemilikan form | Form yang dibuat pengguna otomatis terikat sebagai miliknya (`user_id`), sehingga pengguna biasa pun bertindak sebagai "admin" atas form miliknya | Relasi SQLAlchemy `User.forms` (`relationship`, `back_populates`), dicek di setiap endpoint lewat dependency `get_current_user` + filter query `.filter(Form.user_id == current_user.id)` |

### 3.2 Modul Pembuatan Form/Quiz

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-05 | Buat form baru | Admin dapat membuat form dengan judul, deskripsi, dan tipe (`form`/`quiz`) | Pydantic schema `FormCreate` (request) terpisah dari `FormResponse` (response), model SQLAlchemy `Form` |
| FR-06 | Tambah soal | Admin dapat menambahkan soal dengan 4 tipe: pilihan ganda, checkbox, isian singkat, essay | Kolom `type` di model `Question` pakai Python `Enum`, divalidasi otomatis oleh Pydantic saat request masuk |
| FR-07 | Atur opsi jawaban | Untuk tipe pilihan ganda/checkbox, admin dapat menambah opsi jawaban dan menandai opsi yang benar | Nested Pydantic schema (`QuestionCreate` berisi `list[OptionCreate]`), insert relasi `Question.options` sekaligus dalam satu transaksi SQLAlchemy |
| FR-08 | Reorder soal | Admin dapat mengubah urutan tampil soal (`order_index`) | Endpoint `PATCH /questions/reorder` menerima `list[{id, order_index}]`, di-update lewat bulk update SQLAlchemy (`session.bulk_update_mappings` atau loop `session.merge`) |
| FR-09 | Tambah gambar | Admin dapat menambahkan gambar (upload file atau link eksternal) pada soal maupun opsi jawaban, mendukung lebih dari satu gambar per soal/opsi | Upload file lewat FastAPI `UploadFile`, disimpan ke storage (lokal/S3-compatible), path disimpan di model `Image`; untuk link eksternal cukup simpan URL tanpa upload |
| FR-10 | Soal wajib/opsional | Admin dapat menandai status wajib diisi (`is_required`) per soal | Kolom boolean `is_required`, divalidasi di frontend (blocking submit) **dan** di backend (validasi ulang saat submit final) |
| FR-11 | Simpan draft | Form yang belum dipublikasikan tersimpan dengan status `draft` | Default value `status="draft"` di model SQLAlchemy |
| FR-12 | Publikasikan form | Admin dapat mengubah status form menjadi `published` agar dapat diakses responden | `PATCH /forms/{id}/publish`, validasi minimal 1 soal sebelum diizinkan lewat query count sebelum update |

### 3.3 Modul Import Soal

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-13 | Import dari Word | Admin dapat mengunggah file `.docx` berisi soal sesuai format template | Library `python-docx` untuk extract teks dari file yang diterima lewat `UploadFile` |
| FR-14 | Parsing otomatis | Sistem membaca teks sesuai pola template dan mengonversinya menjadi entri soal + opsi jawaban secara otomatis | Fungsi parser custom (regex-based) yang sama dipakai baik untuk import text maupun hasil extract docx |
| FR-15 | Validasi hasil import | Sistem menampilkan preview hasil parsing sebelum disimpan permanen, agar admin dapat mengoreksi kesalahan parsing | Endpoint import **hanya** return JSON preview (tidak insert ke DB), endpoint terpisah `import/confirm` yang benar-benar insert setelah dikoreksi user di frontend |

### 3.4 Modul Distribusi (Share & Access)

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-16 | Generate short link | Sistem menghasilkan `short_code` unik otomatis saat form dipublikasikan | Generate string random (`secrets.token_urlsafe` dipotong, atau base62 dari ID), dicek keunikan lewat query sebelum simpan |
| FR-17 | Generate QR Code | Sistem menghasilkan QR Code yang mengarah ke short link form | Digenerate di **frontend** (library `qrcode.react`) dari `short_code` yang diterima API — backend tidak perlu generate gambar QR, cukup kirim string URL |
| FR-18 | Mode Public/Private | Admin dapat mengatur form dapat diakses publik atau hanya dengan izin tertentu | Kolom boolean `is_public`, dicek di endpoint publik `GET /q/{short_code}` |
| FR-19 | Wajib login | Admin dapat mewajibkan responden login sebelum mengisi form (`require_login`) | Kolom boolean `require_login`, dicek di `GET /q/{short_code}/start`, React redirect ke halaman login kalau `true` dan belum ada token |

### 3.5 Modul Timer & Kontrol Sesi

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-20 | Set jadwal aktif | Admin menetapkan `starts_at` dan `ends_at` — form/quiz hanya dapat diakses dalam rentang waktu tersebut | Kolom `DateTime(timezone=True)` di SQLAlchemy, dikirim sebagai ISO 8601 UTC lewat Pydantic |
| FR-21 | Edit ulang jadwal | Admin dapat mengubah `starts_at`/`ends_at` kapan saja tanpa kehilangan data soal atau hasil sebelumnya | `PUT /forms/{id}` partial update (field opsional di Pydantic schema `FormUpdate`) |
| FR-22 | Durasi per peserta | Admin dapat menetapkan `timer_seconds` sebagai batas waktu pengerjaan sejak peserta memulai (`started_at`) | Kolom integer, dihitung di backend saat `POST /submissions` (`started_at = datetime.utcnow()`) |
| FR-23 | Kombinasi validasi waktu | Sistem menghitung batas akhir efektif sebagai `LEAST(started_at + timer_seconds, ends_at)` | Dihitung di Python (`min(started_at + timedelta(seconds=timer_seconds), ends_at)`), **bukan** dipercayakan ke perhitungan frontend |
| FR-24 | Auto-submit | Sistem otomatis men-submit jawaban peserta saat waktu habis, dengan status `auto_submitted` | Dicek di setiap request `autosave`/`submit` — kalau `now() > expired_at`, backend paksa ubah status jadi `auto_submitted` walau request yang masuk adalah `autosave` biasa |
| FR-25 | Tolak akses di luar jadwal | Sistem menolak akses pengisian jika waktu saat ini berada di luar rentang `starts_at`–`ends_at` | Validasi di `GET /q/{short_code}/start`, return HTTP 403/410 sesuai kondisi |

### 3.6 Modul Pengisian Form (Sisi Responden)

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-26 | Akses via link/QR | Responden dapat membuka form melalui short link atau hasil scan QR code | React Router route dinamis `/q/:shortCode` |
| FR-27 | Render soal dinamis | Sistem menampilkan soal sesuai tipe dan gambar terkait (jika ada) | Component React per tipe soal (`MultipleChoiceQuestion`, `CheckboxQuestion`, `ShortAnswerQuestion`, `EssayQuestion`), dipilih lewat mapping berdasarkan field `type` dari response API |
| FR-28 | Shuffle soal | Jika `shuffle_questions` aktif, urutan soal diacak dan disimpan konsisten per submission | Random shuffle dilakukan di backend (Python `random.shuffle`) saat `POST /submissions`, hasil urutan disimpan ke tabel `submission_question_order` |
| FR-29 | Shuffle opsi | Jika `shuffle_options` aktif, urutan opsi diacak dan disimpan konsisten per submission | Sama seperti FR-28, tersimpan ke `submission_option_order` |
| FR-30 | Auto-save jawaban | Setiap perubahan jawaban tersimpan otomatis ke tabel `answers` tanpa menunggu submit akhir | React: debounce ~500ms sebelum trigger `axios.patch()` ke `/submissions/{id}/autosave`, backend melakukan upsert (`INSERT ... ON DUPLICATE KEY UPDATE` via SQLAlchemy) |
| FR-31 | Submit jawaban | Responden dapat menyelesaikan dan mengirim seluruh jawaban | `POST /submissions/{id}/submit`, tidak menerima body — backend hitung skor dari data `answers` yang sudah tersimpan |
| FR-32 | Validasi limit submit | Sistem menolak submission tambahan jika `submission_limit = once` dan responden sudah pernah submit | Query cek existing submission `status IN ('submitted', 'auto_submitted')` berdasarkan `user_id` atau `ip_address` (`request.client.host` di FastAPI) sebelum membuat submission baru |

### 3.7 Modul Penilaian & Hasil

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-33 | Auto-grading | Sistem menghitung otomatis kebenaran jawaban untuk tipe pilihan ganda dan checkbox | Fungsi service Python: bandingkan `set` opsi yang dipilih dengan `set` opsi yang `is_correct=True` |
| FR-34 | Feedback instan | Responden melihat status Benar/Salah setelah submit | Field `is_correct` dan `points_earned` di response `GET /submissions/{id}`, dirender di React dengan animasi (`framer-motion`) sesuai referensi desain di `prd-quizary.md` |
| FR-35 | Skor akhir | Sistem menghitung total skor (`score`) dari seluruh jawaban yang dinilai | `SUM(points_earned)` dihitung di backend saat submit, disimpan ke kolom `score` di `submissions` (bukan dihitung ulang tiap kali diakses, supaya konsisten histori) |
| FR-36 | Hasil real-time | Admin dapat melihat daftar submission dan skor secara real-time setelah responden submit | Polling interval (React Query `refetchInterval`) ke `GET /forms/{id}/results` — **bukan** WebSocket di versi awal, cukup polling tiap beberapa detik |
| FR-37 | Statistik | Sistem menghitung nilai rata-rata dan menyediakan grafik distribusi jawaban | Query agregat SQLAlchemy (`func.avg`, `func.max`, `func.min`), grafik dirender di React (library chart seperti `recharts`) |
| FR-38 | Ranking | Sistem dapat menampilkan peringkat peserta berdasarkan skor (opsional per form) | `ORDER BY score DESC` di query hasil, ranking dihitung di response (index array), bukan kolom tersimpan |
| FR-39 | Export Excel | Admin dapat mengekspor data hasil ke format Excel | Library `openpyxl`, endpoint return `StreamingResponse` dengan `Content-Type` spreadsheet |
| FR-40 | Export PDF | Admin dapat mengekspor data hasil ke format PDF | Library `reportlab` atau `weasyprint` (HTML-to-PDF), endpoint return `StreamingResponse` |

### 3.8 Modul Kustomisasi Tampilan

| ID | Kebutuhan | Deskripsi | Implementasi Teknis |
|---|---|---|---|
| FR-41 | Tema warna | Admin dapat memilih warna tema tampilan form | Kolom `theme_color` (hex string), diterapkan di React lewat CSS custom property (`style={{ '--color-primary': theme_color }}`), dikonsumsi oleh Tailwind lewat arbitrary value |
| FR-42 | Banner | Admin dapat mengunggah banner (gambar header) untuk form, ditampilkan di bagian atas halaman pengisian | Upload lewat `UploadFile`, path disimpan di kolom `banner_path` |
| FR-43 | Pesan penutup | Admin dapat mengatur pesan terima kasih custom yang tampil setelah responden submit | Kolom `thank_you_message` (text), dirender langsung di halaman hasil React |

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| ID | Kategori | Kebutuhan | Catatan Implementasi |
|---|---|---|---|
| NFR-01 | Performa | Waktu render halaman pengisian form maksimal 2 detik pada koneksi standar | Lazy load gambar, code-splitting React per route (`React.lazy` + `Suspense`) |
| NFR-02 | Skalabilitas | Struktur database mendukung penambahan jumlah soal/responden tanpa perubahan skema | Model SQLAlchemy sudah dirancang generik (lihat Section 5), index sudah ditambahkan pada foreign key yang sering di-query |
| NFR-03 | Keamanan | Validasi shuffle, limit submit, dan waktu jadwal dijalankan sepenuhnya di backend, tidak bergantung pada validasi klien | Semua validasi ini ada di layer service FastAPI, dipanggil dari endpoint, **tidak boleh** ada logic serupa hanya di React tanpa mirror di backend |
| NFR-04 | Keamanan data | Password pengguna disimpan terenkripsi (hashing), bukan plain text | `passlib[bcrypt]`, jangan pernah simpan/log password plain text bahkan di level development |
| NFR-05 | Ketersediaan | Auto-save memastikan tidak ada kehilangan data jawaban akibat koneksi terputus atau keluar tab | React: retry otomatis (axios interceptor) kalau autosave gagal karena network error, simpan draft sementara di memory state sebelum berhasil terkirim |
| NFR-06 | Usability | Antarmuka pengisian form sederhana dan dapat digunakan tanpa instruksi tambahan (self-explanatory) | Mengikuti design system di `prd-quizary.md` Section 8 |
| NFR-07 | Kompatibilitas | Sistem responsif dan berfungsi baik pada perangkat desktop maupun mobile | Tailwind responsive utility (`sm:`, `md:`, `lg:`), mobile-first breakpoint |
| NFR-08 | Maintainability | Struktur kode dan database mengikuti konvensi FastAPI (router/schema/model/service terpisah) agar mudah dipelihara dan dikembangkan lanjut | Lihat Section 6 untuk struktur folder yang disepakati |
| NFR-09 | Portabilitas ekspor | File hasil ekspor (Excel/PDF) dapat dibuka di aplikasi standar tanpa memerlukan software tambahan | Format `.xlsx` standar (bukan `.xls` lama), PDF standar tanpa enkripsi/proteksi tambahan |
| NFR-10 | Konsistensi data | Urutan hasil shuffle per peserta tidak berubah selama sesi submission masih berlangsung (meski halaman di-reload) | React: saat reload, fetch ulang urutan soal dari `GET /submissions/{id}` (yang membaca `submission_question_order`), **bukan** shuffle ulang di client |

---

## 5. Kebutuhan Data & Arsitektur Backend (FastAPI + SQLAlchemy)

### 5.1 Entitas Utama

| Entitas | Deskripsi Singkat | Model SQLAlchemy |
|---|---|---|
| `users` | Data akun pengguna dan role | `User` |
| `forms` | Data form/quiz, konfigurasi jadwal, timer, tampilan, dan keamanan | `Form` |
| `questions` | Data soal per form | `Question` |
| `question_options` | Opsi jawaban per soal | `QuestionOption` |
| `images` | Gambar (file/link) terkait soal atau opsi, mendukung multi-gambar | `Image` |
| `submissions` | Data satu kali pengisian form oleh responden | `Submission` |
| `answers` | Jawaban responden per soal | `Answer` |
| `answer_options` | Opsi yang dipilih responden (untuk checkbox bisa lebih dari satu) | `AnswerOption` |
| `submission_question_order` | Urutan hasil shuffle soal per submission | `SubmissionQuestionOrder` |
| `submission_option_order` | Urutan hasil shuffle opsi per submission | `SubmissionOptionOrder` |

### 5.2 Struktur Proyek Backend (FastAPI)

```
backend/
├── app/
│   ├── main.py                 # entrypoint, register semua router
│   ├── database.py             # engine, SessionLocal (SQLAlchemy + PyMySQL)
│   ├── models/                 # 1 file per entitas, class SQLAlchemy
│   │   ├── user.py
│   │   ├── form.py
│   │   ├── question.py
│   │   └── ...
│   ├── schemas/                # Pydantic schema, dipisah per operasi
│   │   ├── user.py              # UserCreate, UserResponse, UserUpdate
│   │   ├── form.py
│   │   └── ...
│   ├── routers/                 # 1 file per modul, isi endpoint FastAPI
│   │   ├── auth.py
│   │   ├── forms.py
│   │   ├── questions.py
│   │   ├── submissions.py
│   │   └── ...
│   ├── services/                 # logic bisnis (grading, shuffle, parser import)
│   │   ├── grading.py
│   │   ├── shuffle.py
│   │   └── import_parser.py
│   ├── dependencies.py          # get_current_user, require_role, get_db
│   └── config.py                # environment variables (.env)
├── alembic/                      # migration history
├── requirements.txt
└── .env
```

**Alasan pemisahan `schemas` dan `models`:** Pydantic schema (request/response) **tidak boleh** langsung dipakai sebagai model SQLAlchemy — keduanya punya tanggung jawab beda. Model merepresentasikan struktur tabel database, schema merepresentasikan bentuk data yang boleh masuk/keluar API. Contoh: field `password` ada di model `User` tapi **tidak boleh** ada di schema `UserResponse`.

### 5.3 Library Backend & Fungsinya

| Library | Fungsi |
|---|---|
| `fastapi` | Framework utama, routing, dependency injection, validasi otomatis |
| `sqlalchemy` | ORM, mapping model ke tabel MySQL |
| `pymysql` | Driver koneksi ke MySQL (dipakai SQLAlchemy sebagai backend) |
| `pydantic` | Validasi & serialisasi schema request/response |
| `alembic` | Migration database (versioning skema, agar tim bisa sinkron struktur tabel) |
| `passlib[bcrypt]` | Hashing password |
| `python-jose` | Encode/decode JWT untuk autentikasi |
| `python-multipart` | Wajib untuk menerima `UploadFile` (upload gambar, banner, docx) |
| `python-docx` | Parsing file Word untuk fitur import soal |
| `openpyxl` | Generate file Excel untuk export hasil |
| `reportlab` / `weasyprint` | Generate file PDF untuk export hasil |
| `python-dotenv` | Membaca konfigurasi dari `.env` |

---

## 6. Kebutuhan Antarmuka & Arsitektur Frontend (React)

### 6.1 Antarmuka Pengguna (UI)
- Dashboard admin: daftar form, tombol buat form baru, akses ke hasil dan pengaturan
- Form builder: panel tambah/edit soal, preview langsung, pengaturan jadwal & keamanan
- Halaman pengisian publik: mengikuti design system gamified di `prd.md` Section 8 (khusus mode Quiz), atau gaya standar untuk mode Form
- Halaman hasil: tabel submission, grafik statistik, tombol export

### 6.2 Struktur Proyek Frontend (React)

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # setup React Router
│   ├── api/
│   │   ├── axiosClient.js        # instance axios + interceptor auth token
│   │   ├── forms.js               # fungsi request terkait form
│   │   ├── questions.js
│   │   └── submissions.js
│   ├── pages/                     # 1 file per halaman (lihat daftar halaman di prd-quizary.md)
│   │   ├── admin/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── FormBuilder.jsx
│   │   │   └── Results.jsx
│   │   └── public/
│   │       ├── LandingForm.jsx
│   │       ├── QuizFill.jsx
│   │       └── QuizResult.jsx
│   ├── components/
│   │   ├── questions/              # 1 komponen per tipe soal
│   │   │   ├── MultipleChoiceQuestion.jsx
│   │   │   ├── CheckboxQuestion.jsx
│   │   │   ├── ShortAnswerQuestion.jsx
│   │   │   └── EssayQuestion.jsx
│   │   ├── FeedbackBanner.jsx        # animasi framer-motion, benar/salah
│   │   └── ProgressBar.jsx
│   ├── hooks/
│   │   ├── useAutosave.js            # debounce + axios patch
│   │   └── useTimer.js                # hitung countdown dari expired_at server
│   ├── context/
│   │   └── AuthContext.jsx
│   └── styles/
│       └── tailwind.config.js         # design tokens warna dari prd-quizary.md Section 8.2
├── package.json
└── .env
```

### 6.3 Library Frontend & Fungsinya

| Library | Fungsi |
|---|---|
| `react` | Library UI utama |
| `react-router-dom` | Routing SPA (`/forms/:id`, `/q/:shortCode`, dst) |
| `axios` | HTTP client ke FastAPI, dengan interceptor untuk inject `Authorization: Bearer` otomatis |
| `framer-motion` | Animasi transisi antar soal, banner feedback benar/salah (sesuai referensi UI di `prd-quizary.md`) |
| `tailwindcss` | Styling utility-first, dikonfigurasi dengan design token warna dari PRD |
| `qrcode.react` *(sesuai kebutuhan)* | Generate QR Code dari `short_code` langsung di klien |
| `@tanstack/react-query` *(direkomendasikan, sesuaikan kebutuhan)* | Cache & refetch data (misal polling hasil real-time di FR-36) tanpa state management manual berlebihan |
| `recharts` *(sesuai kebutuhan)* | Grafik statistik hasil (FR-37) |

### 6.4 Antarmuka Perangkat Keras
Tidak ada kebutuhan perangkat keras khusus — sistem berjalan di browser standar pada perangkat desktop, tablet, atau smartphone, serta companion app Android untuk sisi responden.

---

## 7. Matriks Keterunutan Fitur → Requirement

| Fitur Awal | Requirement Terkait |
|---|---|
| Form & Quiz Maker | FR-05 s.d. FR-12 |
| Share & Access | FR-16 s.d. FR-19 |
| Timer & Control | FR-20 s.d. FR-25 |
| Import Soal | FR-13 s.d. FR-15 |
| Result & Export | FR-36 s.d. FR-40 |
| Quiz System (Scoring) | FR-33 s.d. FR-35, FR-38 |
| Custom Design | FR-41 s.d. FR-43 |
| User Management | FR-01 s.d. FR-04 |
| Security | FR-28, FR-29, FR-32, NFR-03 |
| Responsive | NFR-07 |
| Auto Save | FR-30, NFR-05 |
| Thank You Message | FR-43 |

---

## 8. Keputusan Teknis Tambahan (Spesifik Tech Stack)

Bagian ini menjawab pertanyaan implementasi yang sering muncul di tengah development, supaya tidak diputuskan berbeda-beda oleh anggota tim atau AI agent yang berbeda sesi.

### 8.1 Autentikasi: JWT, bukan Session
FastAPI tidak punya session management bawaan seperti Laravel Sanctum. Sistem ini pakai **JWT stateless**: `POST /login` mengembalikan token, disimpan di frontend, dikirim ulang lewat header `Authorization: Bearer` di tiap request yang butuh auth. Tidak ada tabel `sessions` di database.

### 8.2 Generate QR Code: di Frontend, bukan Backend
Backend cukup mengirim `short_code`/URL lengkap. Rendering QR Code jadi tanggung jawab React (`qrcode.react`) — mengurangi beban backend generate gambar, dan QR bisa langsung diperbarui di klien tanpa request tambahan kalau tema warna form ikut memengaruhi QR (opsional).

### 8.3 Penyimpanan Token: httpOnly Cookie vs localStorage
Rekomendasi: **httpOnly cookie** untuk keamanan (tidak bisa diakses lewat JavaScript, mengurangi risiko XSS mencuri token). Kalau tim memilih localStorage karena kemudahan development, catat sebagai trade-off keamanan yang disadari, bukan default tanpa pertimbangan.

### 8.4 Migration Database: Alembic
Perubahan skema database **wajib** lewat migration file Alembic, bukan edit langsung ke database production. Ini memastikan histori perubahan skema tercatat dan bisa direplikasi di environment lain.

### 8.5 Realtime Hasil: Polling, bukan WebSocket (untuk versi awal)
FR-36 ("hasil real-time") dipenuhi lewat polling interval di React (`react-query` `refetchInterval`), bukan WebSocket/Server-Sent Events. Ini pilihan sadar untuk menyederhanakan kompleksitas infrastruktur di rilis awal — bisa ditingkatkan ke WebSocket kalau kebutuhan skala membesar.

---

## 9. Riwayat Revisi Dokumen

| Versi | Perubahan |
|---|---|
| 1.0 | Draft awal disusun berdasarkan hasil analisis fitur dan struktur database tahap perencanaan |
| 2.0 | Diselaraskan dengan tech stack final (FastAPI + SQLAlchemy + PyMySQL + Pydantic di backend, React + axios + framer-motion + react-router-dom + Tailwind di frontend); ditambahkan kolom Implementasi Teknis di tiap requirement, struktur folder backend & frontend, daftar library beserta fungsinya, dan Section 8 (Keputusan Teknis Tambahan) |

---

*Dokumen ini bersifat hidup (living document) dan dapat diperbarui seiring perkembangan pemahaman kebutuhan selama proses pengembangan berlangsung.*