# API Contract — Form & Quiz Maker

Format tiap endpoint: **Method Path**, Auth, Request Body, Response Body, Status Code.
`Auth: -` = publik, `Auth: Bearer Token` = wajib login.

---

## 1. Authentication

### `POST /register`
Auth: -
```json
// Request
{
  "name": "Ahmad Faqih",
  "email": "faqih@sekolah.sch.id",
  "password": "password123",
  "password_confirmation": "password123"
}
```
```json
// Response 201
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "name": "Ahmad Faqih", "email": "faqih@sekolah.sch.id", "role": "user", "avatar": null }
}
```
```json
// Response 409 (email sudah terdaftar)
{ "message": "Email already registered" }
```

### `POST /login`
Auth: -
```json
// Request
{ "email": "faqih@sekolah.sch.id", "password": "password123" }
```
```json
// Response 200
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "name": "Ahmad Faqih", "role": "user", "avatar": null }
}
```
```json
// Response 401
{ "message": "Invalid email or password" }
```

### `POST /logout`
Auth: Bearer Token
```json
// Response 200
{ "message": "Logged out successfully" }
```

### `GET /me`
Auth: Bearer Token
```json
// Response 200
{ "id": 1, "name": "Ahmad Faqih", "email": "faqih@sekolah.sch.id", "role": "user", "avatar": null }
```

### `PUT /me`
Auth: Bearer Token — `multipart/form-data`
```
// Request (form-data)
name: "Ahmad Faqih Ar Rifa'i"
avatar: <file.png>   (opsional)
```
```json
// Response 200
{ "id": 1, "name": "Ahmad Faqih Ar Rifa'i", "email": "faqih@sekolah.sch.id", "role": "user", "avatar": "http://localhost:8000/uploads/avatars/abc123.png" }
```

### `POST /me/avatar`
Auth: Bearer Token — `multipart/form-data`
```
// Request (form-data)
avatar: <file.png>
```
```json
// Response 200
{ "id": 1, "name": "Ahmad Faqih", "email": "faqih@sekolah.sch.id", "role": "user", "avatar": "http://localhost:8000/uploads/avatars/abc123.png" }
```

---

## 2. Forms

### `GET /forms`
Auth: Bearer Token — mengembalikan form milik user login
Query params: `?status=published&type=quiz&page=1&per_page=10`
```json
// Response 200
{
  "data": [
    { "id": 2, "title": "Quiz Matematika Dasar", "type": "quiz", "status": "published", "short_code": "QZM002B" }
  ],
  "meta": { "total": 10, "page": 1, "per_page": 10 }
}
```

### `POST /forms`
Auth: Bearer Token
```json
// Request
{
  "title": "Quiz Matematika Dasar",
  "description": "Quiz materi aljabar",
  "type": "quiz",
  "is_public": true,
  "require_login": false,
  "submission_limit": "once"
}
```
```json
// Response 201
{
  "id": 2,
  "title": "Quiz Matematika Dasar",
  "description": "Quiz materi aljabar",
  "type": "quiz",
  "status": "draft",
  "short_code": "QZM002B",
  "is_public": true,
  "require_login": false,
  "theme_color": null,
  "banner_path": null,
  "thank_you_message": null,
  "timer_seconds": null,
  "starts_at": null,
  "ends_at": null,
  "shuffle_questions": false,
  "shuffle_options": false,
  "submission_limit": "once",
  "created_at": "30-07-2026 18:00:00",
  "updated_at": "30-07-2026 18:00:00"
}
```

### `GET /forms/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{
  "id": 2,
  "title": "Quiz Matematika Dasar",
  "description": "Quiz materi aljabar",
  "type": "quiz",
  "status": "published",
  "short_code": "QZM002B",
  "is_public": true,
  "require_login": false,
  "theme_color": "#EF4444",
  "banner_path": "http://localhost:8000/uploads/banners/math-quiz.png",
  "thank_you_message": "Terima kasih telah mengerjakan quiz ini",
  "timer_seconds": 600,
  "starts_at": "30-07-2026 18:00:00",
  "ends_at": "31-07-2026 18:00:00",
  "shuffle_questions": true,
  "shuffle_options": true,
  "submission_limit": "once",
  "created_at": "30-07-2026 18:00:00",
  "updated_at": "30-07-2026 18:00:00"
}
```
```json
// Response 404
{ "message": "Form not found" }
```

### `PUT /forms/{id}`
Auth: Bearer Token (pemilik) — kirim field yang berubah saja
```json
// Request
{
  "starts_at": "30-07-2026 18:00:00",
  "ends_at": "31-07-2026 18:00:00",
  "timer_seconds": 900,
  "shuffle_questions": true
}
```
```json
// Response 200 — mengembalikan full form object (sama seperti GET)
{
  "id": 2,
  "title": "Quiz Matematika Dasar",
  "type": "quiz",
  "status": "draft",
  "short_code": "QZM002B",
  "starts_at": "30-07-2026 18:00:00",
  "ends_at": "31-07-2026 18:00:00",
  "timer_seconds": 900,
  "shuffle_questions": true,
  "shuffle_options": false,
  ...
}
```
```json
// Response 403
{ "message": "You are not the owner of this form" }
```
```json
// Response 404
{ "message": "Form not found" }
```
```json
// Response 422 — status diubah ke "published" tapi form belum punya soal
{ "message": "Form must have at least 1 question before publishing" }
```

**Konversi tipe (`type`):**
- `form` → `quiz`: opsi pertama tiap soal pilihan ganda otomatis menjadi benar + poin seluruh soal direset & dibagi otomatis (pool 100).
- `quiz` → `form`: seluruh `is_correct` pada opsi direset ke `false`.

### `DELETE /forms/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Form and all related data have been deleted" }
```

### `PATCH /forms/{id}/publish`
Auth: Bearer Token (pemilik)
```json
// Request
{ "status": "published" }
```
```json
// Response 200
{ "message": "Form published", "short_code": "QZM002B" }
```
```json
// Response 422 (validasi gagal, misal belum ada soal)
{ "message": "Form must have at least 1 question before publishing" }
```
> Business rule yang sama juga berlaku saat `status` diubah ke `published` lewat `PUT /forms/{id}`.

### `POST /forms/{id}/banner`
Auth: Bearer Token (pemilik) — `multipart/form-data`
```
// Request (form-data)
banner: <file.png>
```
```json
// Response 200
{ "message": "Banner uploaded", "banner_path": "http://localhost:8000/uploads/banners/math-quiz.png" }
```
```json
// Response 422
{ "message": "Unsupported file format, use JPG/PNG/GIF/WEBP" }
```

---

## 3. Questions

### `GET /forms/{id}/questions`
Auth: Bearer Token (pemilik)
```json
// Response 200
{
  "data": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question_text": "Berapa hasil dari 12 x 8?",
      "points": 1,
      "is_scored": true,
      "order_index": 0,
      "is_required": true,
      "options": [
        { "id": 1, "option_text": "80", "is_correct": false, "order_index": 0, "image": null },
        { "id": 2, "option_text": "96", "is_correct": true, "order_index": 1, "image": null }
      ],
      "image": { "id": 1, "path": "http://localhost:8000/uploads/question-images/q1.png" }
    }
  ]
}
```

### `POST /forms/{id}/questions`
Auth: Bearer Token (pemilik)
```json
// Request
{
  "type": "multiple_choice",
  "question_text": "Berapa hasil dari 12 x 8?",
  "points": 1,
  "is_required": true,
  "options": [
    { "option_text": "80", "is_correct": false },
    { "option_text": "96", "is_correct": true }
  ]
}
```
```json
// Response 201 — full question object (sama seperti GET data item)
{
  "id": 1,
  "type": "multiple_choice",
  "question_text": "Berapa hasil dari 12 x 8?",
  "points": 1,
  "is_scored": true,
  "order_index": 0,
  "is_required": true,
  "options": [
    { "id": 1, "option_text": "80", "is_correct": false, "order_index": 0, "image": null },
    { "id": 2, "option_text": "96", "is_correct": true, "order_index": 1, "image": null }
  ],
  "image": null
}
```
```json
// Response 422 — misal multiple_choice tidak punya tepat 1 jawaban benar
{ "message": "multiple_choice questions must have exactly 1 correct option" }
```

### `PUT /questions/{id}`
Auth: Bearer Token (pemilik form terkait)
```json
// Request — kirim field yang berubah
{
  "question_text": "Berapa hasil dari 12 x 9?",
  "points": 2,
  "is_scored": true,
  "options": [
    { "id": 1, "option_text": "80", "is_correct": false },
    { "id": 2, "option_text": "108", "is_correct": true }
  ]
}
```
```json
// Response 200 — full question object (sama seperti POST)
{
  "id": 1,
  "type": "multiple_choice",
  "question_text": "Berapa hasil dari 12 x 9?",
  "points": 2,
  "is_scored": true,
  "order_index": 0,
  "is_required": true,
  "options": [ ... ],
  "image": null
}
```
**Aturan `is_scored`:**
- `false` → soal tidak dihitung poin (detail-only): poin dipaksa 0, dikeluarkan dari distribusi pool & dari penilaian (muncul "Not graded").
- `true` → soal ikut pool poin quiz; jika `points` tidak dikirim, kembali ke pool auto-distribusi.
- Ganti type dari `multiple_choice`/`checkbox` ke `short_answer`/`essay` dengan `options: []` **diperbolehkan** (opsi lama dihapus) — hanya `options` yang berisi item yang ditolak.

**Distribusi poin quiz (pool 100):**
- Tambah/import/hapus soal, atau toggle `is_scored` on → seluruh soal scored dibagi merata (sisa tidak habis dibagi jatuh ke soal terurut awal).
- Edit poin satu soal → poinnya dipertahankan, sisa 100 dibagi merata ke soal scored lain.

### `DELETE /questions/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Question deleted" }
```

### `PATCH /questions/reorder`
Auth: Bearer Token (pemilik)
```json
// Request — orders adalah array ID dalam urutan yang diinginkan
{
  "form_id": 2,
  "orders": [5, 3, 8]
}
```
```json
// Response 200
{ "message": "Question order updated" }
```

---

## 4. Images

### `POST /questions/{id}/images`
Auth: Bearer Token (pemilik) — `multipart/form-data`
```
// Request (form-data)
image: <file.png>
```
```json
// Response 201
{ "id": 4, "path": "http://localhost:8000/uploads/question-images/q1-uploaded.png" }
```
```json
// Response 404
{ "message": "Question not found" }
```

### `POST /options/{option_id}/images`
Auth: Bearer Token (pemilik) — `multipart/form-data`
```
// Request (form-data)
image: <file.png>
```
```json
// Response 201
{ "id": 5, "path": "http://localhost:8000/uploads/question-images/opt-1.png" }
```

### `DELETE /images/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Image deleted" }
```

### `DELETE /options/{option_id}/images/{image_id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Image deleted" }
```

---

## 5. Import Soal

### `POST /forms/{form_id}/import/docx`
Auth: Bearer Token (pemilik) — `multipart/form-data`
```
// Request (form-data)
file: <soal.docx>
```
```json
// Response 201 — langsung menyimpan soal dari file
{ "message": "10 question(s) imported successfully", "imported_count": 10 }
```
```json
// Response 422
{ "message": "Only .docx files are supported" }
```
```json
// Response 422 (tidak ada soal terdeteksi)
{ "message": "No questions could be imported, check document format" }
```

> **Catatan:** Tidak ada endpoint `/import/text` atau `/import/confirm`. Import langsung menyimpan soal. Untuk menambah/mengedit soal, gunakan endpoint Questions biasa.

---

## 6. Share & Access (Publik)

### `GET /q/{short_code}`
Auth: -
```json
// Response 200
{
  "id": 2,
  "title": "Quiz Matematika Dasar",
  "description": "Quiz materi aljabar",
  "type": "quiz",
  "banner_path": "http://localhost:8000/uploads/banners/math-quiz.png",
  "theme_color": "#EF4444",
  "require_login": false,
  "status": "published",
  "starts_at": "30-07-2026 18:00:00",
  "ends_at": "31-07-2026 18:00:00",
  "timer_seconds": 600,
  "thank_you_message": "Terima kasih telah mengerjakan quiz ini"
}
```
```json
// Response 404
{ "message": "Form not found" }
```

### `GET /q/{short_code}/start`
Auth: - (atau Bearer Token kalau `require_login=true`)
```json
// Response 200 (boleh mulai)
{ "can_start": true, "form_id": 2, "require_identity": true }
```
```json
// Response 200 (belum waktunya)
{ "can_start": false, "reason": "not_started", "starts_at": "30-07-2026 18:00:00" }
```
```json
// Response 200 (sudah tutup)
{ "can_start": false, "reason": "closed" }
```
```json
// Response 200 (sudah pernah submit, submission_limit=once)
{ "can_start": false, "reason": "already_submitted" }
```
```json
// Response 401 (require_login=true tapi tidak ada token)
{ "message": "Login required to access this form" }
```

---

## 7. Submission

### `POST /submissions`
Auth: - (atau Bearer Token jika login)
```json
// Request
{
  "form_id": 2,
  "respondent_name": "Dewi Anjani",
  "respondent_email": "dewi@gmail.com"
}
```
```json
// Response 201 — session baru
{
  "submission_id": 11,
  "started_at": "24-07-2026 17:00:00",
  "expired_at": "24-07-2026 17:10:00",
  "questions": [
    {
      "id": 3,
      "type": "checkbox",
      "question_text": "Manakah yang termasuk bilangan prima?",
      "order_index": 0,
      "options": [
        { "id": 9, "option_text": "2", "order_index": 0 },
        { "id": 11, "option_text": "7", "order_index": 1 }
      ]
    }
  ],
  "resumed": false
}
```
```json
// Response 201 — melanjutkan session yang sudah ada (tidak ada 409)
// Terjadi saat user refresh halaman atau kembali nanti
{
  "submission_id": 11,
  "started_at": "24-07-2026 17:00:00",
  "expired_at": "24-07-2026 17:10:00",
  "questions": [ ... ],
  "resumed": true
}
```
```json
// Response 403 (belum waktunya)
{ "message": "Form is not open yet. Opens at 30-07-2026 18:00:00" }
```
```json
// Response 410 (periode sudah berakhir)
{ "message": "Form submission period has ended" }
```
```json
// Response 410 (session sebelumnya expired)
{ "message": "Your previous session has expired" }
```
```json
// Response 409 (submission_limit=once, sudah pernah submit)
{ "message": "You have already submitted this form" }
```

### `PATCH /submissions/{id}/autosave`
Auth: - (sesuai submission) atau Bearer Token (pemilik form)
```json
// Request (pilihan ganda/checkbox)
{ "question_id": 1, "option_ids": [2] }
```
```json
// Request (isian singkat/essay)
{ "question_id": 5, "answer_text": "I have finished my homework." }
```
```json
// Response 200
{ "message": "Answer saved", "question_id": 1 }
```
```json
// Response 410 (waktu habis — submission auto-submitted)
{ "message": "Submission time has expired" }
```
```json
// Response 409 (submission sudah selesai)
{ "message": "Submission already completed" }
```

### `POST /submissions/{id}/submit`
Auth: - (sesuai submission) atau Bearer Token (pemilik form)
```json
// Request: (kosong, submission_id dari path)
```
```json
// Response 200
{
  "message": "Submission completed successfully",
  "status": "submitted",
  "score": 3,
  "max_score": 3
}
```
```json
// Response 200 — waktu habis (auto-submitted)
{
  "message": "Submission completed successfully",
  "status": "auto_submitted",
  "score": 3,
  "max_score": 3
}
```
```json
// Response 409
{ "message": "Submission already completed" }
```

### `GET /submissions/{id}`
Auth: - (respondent via IP) atau Bearer Token (respondent/owner)
```json
// Response 200
{
  "id": 11,
  "status": "submitted",
  "started_at": "24-07-2026 17:00:00",
  "expired_at": "24-07-2026 17:10:00",
  "score": 3,
  "max_score": 3,
  "submitted_at": "24-07-2026 17:08:00",
  "questions": [ ... ],
  "answers": [
    {
      "question_id": 1,
      "question_text": "Berapa hasil dari 12 x 8?",
      "question_type": "multiple_choice",
      "selected_option_ids": [2],
      "answer_text": null,
      "selected_options": ["96"],
      "is_correct": true,
      "points_earned": 1
    }
  ]
}
```

### `GET /me/submissions`
Auth: Bearer Token
```json
// Response 200
{
  "data": [
    { "id": 9, "form_title": "Survey Kepuasan Siswa", "status": "submitted", "score": null, "submitted_at": "23-07-2026 16:00:00" }
  ]
}
```

---

## 8. Result & Analytics

### `GET /forms/{id}/results`
Auth: Bearer Token (pemilik)
Query params: `?status=submitted&sort=score_desc&page=1&per_page=10`
```json
// Response 200
{
  "data": [
    { "submission_id": 1, "respondent_name": "Dewi Anjani", "score": 3, "max_score": 3, "status": "submitted", "submitted_at": "24-07-2026 17:08:00", "answer_summary": "Merah · Tambahkan dark mode" }
  ],
  "meta": { "total": 25, "page": 1, "per_page": 10 }
}
```
`answer_summary` diisi untuk **form type** (pratinjau jawaban responden, dipakai kolom "Answers" di UI); untuk quiz tetap kosong. `sort=score_desc/asc` hanya relevan untuk quiz.

### `GET /forms/{id}/analytics`
Auth: Bearer Token (pemilik)

Response bergantung pada tipe form (`type` field).

**Quiz (`type: "quiz"`)** — skor & akurasi:
```json
{
  "type": "quiz",
  "total_participants": 25,
  "average_score": 2.4,
  "highest_score": 3,
  "lowest_score": 0,
  "correct_rate": 0.78,
  "wrong_rate": 0.22,
  "score_distribution": [
    { "range": "0-1", "count": 3 },
    { "range": "2-3", "count": 22 }
  ],
  "per_question_stats": [
    { "question_id": 1, "correct_count": 20, "wrong_count": 5 }
  ],
  "total_answers": 0,
  "completion_rate": 0,
  "avg_answers": 0,
  "question_stats": []
}
```

**Form (`type: "form"`)** — frekuensi jawaban:
```json
{
  "type": "form",
  "total_participants": 25,
  "total_answers": 60,
  "completion_rate": 0.92,
  "avg_answers": 2.4,
  "question_stats": [
    {
      "question_id": 1,
      "question_text": "Warna favorit?",
      "type": "multiple_choice",
      "answered": 25,
      "skipped": 0,
      "most_selected": "Biru",
      "most_selected_count": 14,
      "most_selected_pct": 56,
      "option_breakdown": [
        { "option_id": 1, "option_text": "Merah", "count": 8, "pct": 32 },
        { "option_id": 2, "option_text": "Biru", "count": 14, "pct": 56 }
      ],
      "sample_answers": []
    },
    {
      "question_id": 2,
      "question_text": "Saran Anda",
      "type": "essay",
      "answered": 10,
      "skipped": 15,
      "most_selected": null,
      "most_selected_count": 0,
      "most_selected_pct": 0,
      "option_breakdown": [],
      "sample_answers": ["Tambah fitur X", "Lebih simpel"]
    }
  ],
  "average_score": 0,
  "highest_score": 0,
  "lowest_score": 0,
  "correct_rate": 0,
  "wrong_rate": 0,
  "score_distribution": [],
  "per_question_stats": []
}
```

### `GET /forms/{id}/export/excel`
Auth: Bearer Token (pemilik)
```
// Response 200
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="hasil-QZM002B.xlsx"
[binary file]
```
**Struktur kolom (dinamis):** satu kolom per soal (header = teks soal, urut `order_index`), lalu kolom `Dikirim`, `Skor`, `Status`. Jawaban pilihan ganda/checkbox digabung dengan `", "`; teks bebas diambil dari `answer_text`. Baris kosong diisi `-`. Kolom responden/email tidak disertakan.

### `GET /forms/{id}/export/pdf`
Auth: Bearer Token (pemilik)
```
// Response 200
Content-Type: application/pdf
Content-Disposition: attachment; filename="hasil-QZM002B.pdf"
[binary file]
```
**Layout:** judul = nama form + baris `Diekspor pada {tanggal}`, tabel landscape dengan kolom sama seperti export Excel (soal + Dikirim + Skor + Status).

---

## 9. Dashboard

### `GET /dashboard/summary`
Auth: Bearer Token
```json
// Response 200
{
  "total_forms": 6,
  "total_quiz": 4,
  "total_submissions": 48,
  "total_respondents": 40,
  "recent_forms": [
    { "id": 2, "title": "Quiz Matematika Dasar", "status": "published", "submission_count": 12 }
  ],
  "submission_trend": [
    { "date": "2026-07-20", "count": 5 },
    { "date": "2026-07-21", "count": 8 }
  ]
}
```

---

## Daftar Semua Endpoint

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| POST | `/api/register` | - | Daftar akun baru |
| POST | `/api/login` | - | Login |
| POST | `/api/logout` | Bearer | Logout (revoke token) |
| GET | `/api/me` | Bearer | Profil user |
| PUT | `/api/me` | Bearer | Update profil (multipart/form-data) |
| POST | `/api/me/avatar` | Bearer | Upload avatar (multipart/form-data) |
| GET | `/api/forms` | Bearer | Daftar form milik user |
| POST | `/api/forms` | Bearer | Buat form baru |
| GET | `/api/forms/{id}` | Bearer | Detail form |
| PUT | `/api/forms/{id}` | Bearer | Update form (partial) |
| DELETE | `/api/forms/{id}` | Bearer | Hapus form + seluruh data terkait |
| PATCH | `/api/forms/{id}/publish` | Bearer | Ubah status publikasi |
| POST | `/api/forms/{id}/banner` | Bearer | Upload banner (multipart/form-data) |
| GET | `/api/forms/{id}/questions` | Bearer | Daftar soal form |
| POST | `/api/forms/{id}/questions` | Bearer | Tambah soal |
| GET | `/api/forms/{id}/results` | Bearer | Hasil submission (pemilik) |
| GET | `/api/forms/{id}/analytics` | Bearer | Statistik (pemilik) |
| GET | `/api/forms/{id}/export/excel` | Bearer | Export Excel (pemilik) |
| GET | `/api/forms/{id}/export/pdf` | Bearer | Export PDF (pemilik) |
| POST | `/api/forms/{id}/import/docx` | Bearer | Import soal dari .docx |
| PUT | `/api/questions/{id}` | Bearer | Update soal |
| DELETE | `/api/questions/{id}` | Bearer | Hapus soal |
| PATCH | `/api/questions/reorder` | Bearer | Urutkan ulang soal |
| POST | `/api/questions/{id}/images` | Bearer | Upload gambar soal (multipart/form-data) |
| POST | `/api/options/{id}/images` | Bearer | Upload gambar opsi (multipart/form-data) |
| DELETE | `/api/images/{id}` | Bearer | Hapus gambar |
| DELETE | `/api/options/{id}/images/{image_id}` | Bearer | Hapus gambar opsi |
| POST | `/api/submissions` | - | Mulai sesi/submit baru |
| PATCH | `/api/submissions/{id}/autosave` | - | Autosave jawaban |
| POST | `/api/submissions/{id}/submit` | - | Kumpulkan jawaban |
| GET | `/api/submissions/{id}` | - | Detail submission + jawaban |
| GET | `/api/me/submissions` | Bearer | Riwayat submission user |
| GET | `/api/q/{short_code}` | - | Info form publik |
| GET | `/api/q/{short_code}/start` | - | Cek bisa mulai/tidak |
| GET | `/api/dashboard/summary` | Bearer | Ringkasan dashboard |

---

## Konvensi Umum

| Aspek | Aturan |
|---|---|
| Format tanggal | `d-m-Y H:i:s` WIB (UTC+7), contoh `24-07-2026 17:00:00` |
| Auth header | `Authorization: Bearer {token}` |
| Error format 422 | `{ "message": "Invalid fields", "errors": [{ "field": "pesan" }] }` |
| Error format lainnya | `{ "message": "pesan error" }` |
| Pagination | Query `?page=1&per_page=10`, response punya `meta: { total, page, per_page }` |
| ID | Integer auto-increment, kecuali `short_code` yang string |
| Upload limit | Hanya JPG/PNG/GIF/WEBP, file size tidak dibatasi di backend |
| Avatar/banner | Selalu mengembalikan full URL (`http://host/uploads/...`) |
| Image di question | `image` adalah object tunggal (gambar pertama), bukan array |
