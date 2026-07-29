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
  "message": "Registrasi berhasil",
  "user": { "id": 1, "name": "Ahmad Faqih", "email": "faqih@sekolah.sch.id", "role": "user" }
}
```
```json
// Response 422 (validasi gagal)
{ "message": "Email sudah terdaftar", "errors": { "email": ["Email sudah digunakan"] } }
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
  "user": { "id": 1, "name": "Ahmad Faqih", "role": "user" }
}
```
```json
// Response 401
{ "message": "Email atau password salah" }
```

### `POST /logout`
Auth: Bearer Token
```json
// Request: (kosong)
```
```json
// Response 200
{ "message": "Logout berhasil" }
```

### `GET /me`
Auth: Bearer Token
```json
// Response 200
{ "id": 1, "name": "Ahmad Faqih", "email": "faqih@sekolah.sch.id", "role": "user", "avatar": null }
```

### `PUT /me`
Auth: Bearer Token
```json
// Request
{ "name": "Ahmad Faqih Ar Rifa'i", "avatar": "avatars/faqih.png" }
```
```json
// Response 200
{ "message": "Profil diperbarui", "user": { "id": 1, "name": "Ahmad Faqih Ar Rifa'i" } }
```

---

## 2. Forms

### `GET /forms`
Auth: Bearer Token — mengembalikan form milik user login
Query params: `?status=published&type=quiz&page=1`
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
{ "id": 2, "title": "Quiz Matematika Dasar", "status": "draft", "short_code": "QZM002B" }
```

### `GET /forms/{id}`
Auth: Bearer Token (pemilik) — publik hanya kalau dipanggil dari halaman admin
```json
// Response 200
{
  "id": 2,
  "title": "Quiz Matematika Dasar",
  "type": "quiz",
  "status": "published",
  "starts_at": "2026-07-23T08:00:00Z",
  "ends_at": "2026-07-30T08:00:00Z",
  "timer_seconds": 600,
  "shuffle_questions": true,
  "shuffle_options": true,
  "theme_color": "#EF4444",
  "banner_path": "banners/math-quiz.png"
}
```
```json
// Response 404
{ "message": "Form tidak ditemukan" }
```

### `PUT /forms/{id}`
Auth: Bearer Token (pemilik)
```json
// Request (kirim field yang berubah saja)
{
  "starts_at": "2026-07-25T08:00:00Z",
  "ends_at": "2026-07-31T08:00:00Z",
  "timer_seconds": 900,
  "shuffle_questions": true
}
```
```json
// Response 200
{ "message": "Form diperbarui", "id": 2 }
```
```json
// Response 403
{ "message": "Anda bukan pemilik form ini" }
```

### `DELETE /forms/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Form dan seluruh data terkait telah dihapus" }
```

### `PATCH /forms/{id}/publish`
Auth: Bearer Token (pemilik)
```json
// Request
{ "status": "published" }
```
```json
// Response 200
{ "message": "Form dipublikasikan", "short_code": "QZM002B" }
```
```json
// Response 422 (validasi gagal, misal belum ada soal)
{ "message": "Form minimal harus memiliki 1 soal sebelum dipublikasikan" }
```

### `POST /forms/{id}/banner`
Auth: Bearer Token (pemilik) — `multipart/form-data`
```
// Request (form-data)
banner: <file.png>
```
```json
// Response 200
{ "message": "Banner diunggah", "banner_path": "banners/math-quiz.png" }
```
```json
// Response 422
{ "message": "Format file tidak didukung, gunakan JPG/PNG" }
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
      "order_index": 0,
      "is_required": true,
      "options": [
        { "id": 1, "option_text": "80", "is_correct": false },
        { "id": 2, "option_text": "96", "is_correct": true }
      ],
      "images": [{ "id": 1, "path": "question-images/q1.png", "type": "file" }]
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
// Response 201
{ "id": 1, "question_text": "Berapa hasil dari 12 x 8?" }
```

### `PUT /questions/{id}`
Auth: Bearer Token (pemilik form terkait)
```json
// Request
{
  "question_text": "Berapa hasil dari 12 x 9?",
  "points": 2,
  "options": [
    { "id": 1, "option_text": "80", "is_correct": false },
    { "id": 2, "option_text": "108", "is_correct": true }
  ]
}
```
```json
// Response 200
{ "message": "Soal diperbarui", "id": 1 }
```

### `DELETE /questions/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Soal dihapus" }
```

### `PATCH /questions/reorder`
Auth: Bearer Token (pemilik)
```json
// Request
{
  "form_id": 2,
  "orders": [
    { "id": 5, "order_index": 0 },
    { "id": 3, "order_index": 1 },
    { "id": 8, "order_index": 2 }
  ]
}
```
```json
// Response 200
{ "message": "Urutan soal diperbarui" }
```

---

## 4. Images

### `POST /questions/{id}/images`
Auth: Bearer Token (pemilik) — `multipart/form-data` atau JSON untuk link
```json
// Request (link)
{ "type": "link", "path": "https://example.com/image.jpg" }
```
```
// Request (file, multipart)
image: <file.png>
```
```json
// Response 201
{ "id": 4, "path": "question-images/q1-uploaded.png", "type": "file" }
```

### `POST /options/{id}/images`
Auth: Bearer Token (pemilik) — sama seperti di atas, target `option_id`
```json
// Response 201
{ "id": 5, "path": "question-images/opt-1.png", "type": "file" }
```

### `DELETE /images/{id}`
Auth: Bearer Token (pemilik)
```json
// Response 200
{ "message": "Gambar dihapus" }
```

---

## 5. Import Soal

### `POST /forms/{id}/import/text`
Auth: Bearer Token (pemilik)
```json
// Request
{
  "raw_text": "1. Apa ibu kota Indonesia?\nA. Bandung\nB. Jakarta\nC. Surabaya\nJawaban: B"
}
```
```json
// Response 200 (preview, belum tersimpan)
{
  "preview": [
    {
      "question_text": "Apa ibu kota Indonesia?",
      "options": [
        { "text": "Bandung", "is_correct": false },
        { "text": "Jakarta", "is_correct": true },
        { "text": "Surabaya", "is_correct": false }
      ]
    }
  ],
  "valid_count": 1,
  "invalid_count": 0
}
```
```json
// Response 422
{ "message": "Format tidak sesuai template pada soal nomor 2" }
```

### `POST /forms/{id}/import/docx`
Auth: Bearer Token (pemilik) — `multipart/form-data`
```
// Request
file: <soal.docx>
```
```json
// Response 200
{ "preview": [ /* struktur sama seperti import/text */ ], "valid_count": 10, "invalid_count": 1 }
```

**Catatan:** endpoint import hanya mengembalikan preview. Simpan permanen lewat endpoint terpisah:

### `POST /forms/{id}/import/confirm`
Auth: Bearer Token (pemilik)
```json
// Request
{ "questions": [ /* array hasil preview yang sudah dikoreksi user */ ] }
```
```json
// Response 201
{ "message": "10 soal berhasil diimpor", "imported_count": 10 }
```

---

## 6. Share & Access (Publik)

### `GET /q/{short_code}`
Auth: -
```json
// Response 200
{
  "title": "Quiz Matematika Dasar",
  "description": "Quiz materi aljabar",
  "type": "quiz",
  "banner_path": "banners/math-quiz.png",
  "theme_color": "#EF4444",
  "require_login": false,
  "status": "published"
}
```
```json
// Response 404
{ "message": "Form tidak ditemukan" }
```

### `GET /q/{short_code}/start`
Auth: - (atau Bearer Token kalau `require_login=true`)
```json
// Response 200 (boleh mulai)
{ "can_start": true, "form_id": 2, "require_identity": true }
```
```json
// Response 403 (belum waktunya)
{ "can_start": false, "reason": "not_started", "starts_at": "2026-07-25T08:00:00Z" }
```
```json
// Response 410 (sudah tutup/limit tercapai)
{ "can_start": false, "reason": "closed" }
```
```json
// Response 410 (sudah pernah submit, submission_limit=once)
{ "can_start": false, "reason": "already_submitted" }
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
// Response 201
{
  "submission_id": 11,
  "started_at": "2026-07-24T10:00:00Z",
  "expired_at": "2026-07-24T10:10:00Z",
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
  ]
}
```
```json
// Response 409 (sudah ada submission in_progress aktif)
{ "message": "Anda memiliki sesi pengerjaan yang belum selesai", "submission_id": 11 }
```

### `PATCH /submissions/{id}/autosave`
Auth: - (sesuai submission)
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
{ "message": "Jawaban tersimpan", "question_id": 1 }
```
```json
// Response 410 (waktu habis)
{ "message": "Waktu pengerjaan telah berakhir" }
```

### `POST /submissions/{id}/submit`
Auth: - (sesuai submission)
```json
// Request: (kosong, submission_id dari path)
```
```json
// Response 200
{
  "message": "Jawaban berhasil dikirim",
  "status": "submitted",
  "score": 3,
  "max_score": 3
}
```
```json
// Response 409
{ "message": "Submission sudah pernah diselesaikan" }
```

### `GET /submissions/{id}`
Auth: - (sesuai submission) atau Bearer Token (pemilik form)
```json
// Response 200
{
  "id": 11,
  "status": "submitted",
  "score": 3,
  "max_score": 3,
  "submitted_at": "2026-07-24T10:08:00Z",
  "answers": [
    {
      "question_id": 1,
      "question_text": "Berapa hasil dari 12 x 8?",
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
    { "id": 9, "form_title": "Survey Kepuasan Siswa", "status": "submitted", "score": null, "submitted_at": "2026-07-23T09:00:00Z" }
  ]
}
```

---

## 8. Result & Analytics

### `GET /forms/{id}/results`
Auth: Bearer Token (pemilik)
Query params: `?status=submitted&sort=score_desc&page=1`
```json
// Response 200
{
  "data": [
    { "submission_id": 1, "respondent_name": "Dewi Anjani", "score": 3, "max_score": 3, "status": "submitted", "submitted_at": "2026-07-24T08:10:00Z" }
  ],
  "meta": { "total": 25, "page": 1 }
}
```

### `GET /forms/{id}/analytics`
Auth: Bearer Token (pemilik)
```json
// Response 200
{
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
  ]
}
```

---

## 9. Export

### `GET /forms/{id}/export/excel`
Auth: Bearer Token (pemilik)
```
// Response 200
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="hasil-quiz-matematika.xlsx"
[binary file]
```

### `GET /forms/{id}/export/pdf`
Auth: Bearer Token (pemilik)
```
// Response 200
Content-Type: application/pdf
Content-Disposition: attachment; filename="hasil-quiz-matematika.pdf"
[binary file]
```

---

## 10. Dashboard

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

## Konvensi Umum

| Aspek | Aturan |
|---|---|
| Format tanggal | ISO 8601 UTC, contoh `2026-07-24T10:00:00Z` |
| Auth header | `Authorization: Bearer {token}` |
| Error format | `{ "message": "...", "errors": { "field": ["pesan"] } }` (errors hanya muncul saat status 422) |
| Pagination | Query `?page=1&per_page=10`, response selalu punya `meta: { total, page, per_page }` |
| ID | Integer auto-increment, kecuali `short_code` yang string |