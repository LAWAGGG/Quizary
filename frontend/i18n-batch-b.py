import json, re

en = json.load(open('src/locales/en.json'))
idn = json.load(open('src/locales/id.json'))

en['results'] = {
  "eyebrow": "Responses",
  "title": "Results",
  "excel": "Excel",
  "selected": "{{count}} hasil dipilih",
  "deleteSelected": "Delete",
  "cancel": "Cancel",
  "noSubmissions": "No submissions yet",
  "noSubmissionsDesc": "Share your form link to start receiving responses.",
  "deleteConfirm": "Delete results?",
  "deleteMsg": "{{count}} selected results will be deleted permanently along with all their answers.",
  "deleted": "Results deleted",
  "id": "ID",
  "rank": "Rank",
  "respondent": "Respondent",
  "score": "Score / Max",
  "answers": "Answers",
  "status": "Status",
  "submitted": "Submitted",
  "you": "(you)",
  "cheatNote": "Cheat record (tab/fullscreen exits)",
  "cheating": "Detected cheating — tab/fullscreen exits",
  "cheatRecord": "Cheat record (tab/fullscreen exits)",
  "lastRecord": "Last record",
  "infoTitle": "Informasi Ujian",
  "close": "Close",
  "identity": "Identitas Pengisi",
  "name": "Nama",
  "email": "Email",
  "detail": "Detail",
  "questionCount": "Jumlah soal",
  "time": "Waktu",
  "noLimit": "Tanpa batas",
  "once": "Sekali saja",
  "unlimited": "Bebas",
  "loading": "Loading...",
  "noQuestions": "Belum ada soal.",
  "answerSection": "Jawaban pengisi",
  "questions": "pertanyaan",
  "answer": "Jawaban",
  "viewFile": "Lihat file jawaban",
  "correct": "Benar",
  "wrong": "Salah",
  "statusUpdated": "Status diperbarui",
  "statusFailed": "Gagal mengubah status",
  "cheatConfirmTitle": "Vonis curang?",
  "cheatConfirmMsg": "Submission #{{id}} akan diberi status Cheating dengan nilai 0.",
  "cheatConfirmYes": "Ya, nilai 0"
}
idn['results'] = {
  "eyebrow": "Jawaban",
  "title": "Hasil",
  "excel": "Excel",
  "selected": "{{count}} hasil dipilih",
  "deleteSelected": "Hapus",
  "cancel": "Batal",
  "noSubmissions": "Belum ada pengerjaan",
  "noSubmissionsDesc": "Bagikan tautan formulir untuk mulai menerima jawaban.",
  "deleteConfirm": "Hapus hasil?",
  "deleteMsg": "{{count}} hasil terpilih akan dihapus permanen beserta seluruh jawabannya.",
  "deleted": "Hasil dihapus",
  "id": "ID",
  "rank": "Peringkat",
  "respondent": "Responden",
  "score": "Nilai / Maks",
  "answers": "Jawaban",
  "status": "Status",
  "submitted": "Terkirim",
  "you": "(Anda)",
  "cheatNote": "Catatan curang (keluar tab/fullscreen)",
  "cheating": "Terdeteksi curang — keluar tab/fullscreen",
  "cheatRecord": "Ada catatan pelanggaran (keluar tab/fullscreen)",
  "lastRecord": "Pencatatan terakhir",
  "infoTitle": "Informasi Ujian",
  "close": "Tutup",
  "identity": "Identitas Pengisi",
  "name": "Nama",
  "email": "Email",
  "detail": "Detail",
  "questionCount": "Jumlah soal",
  "time": "Waktu",
  "noLimit": "Tanpa batas",
  "once": "Sekali saja",
  "unlimited": "Bebas",
  "loading": "Memuat...",
  "noQuestions": "Belum ada soal.",
  "answerSection": "Jawaban pengisi",
  "questions": "pertanyaan",
  "answer": "Jawaban",
  "viewFile": "Lihat file jawaban",
  "correct": "Benar",
  "wrong": "Salah",
  "statusUpdated": "Status diperbarui",
  "statusFailed": "Gagal mengubah status",
  "cheatConfirmTitle": "Vonis curang?",
  "cheatConfirmMsg": "Submission #{{id}} akan diberi status Cheating dengan nilai 0.",
  "cheatConfirmYes": "Ya, nilai 0"
}

en['analytics'] = {
  "eyebrow": "Insights",
  "title": "Analytics",
  "correctRate": "Correct",
  "wrongRate": "Wrong",
  "scoreSummary": "Score Summary",
  "average": "Average",
  "median": "Median",
  "aboveAverage": "Above Average",
  "belowAverage": "Below Average",
  "summaryHint": "Rata-rata & median menunjukkan pusat nilai peserta. Median lebih kebal terhadap outlier (satu nilai ekstrem) daripada rata-rata: jika median jauh di bawah rata-rata, mayoritas peserta dapat nilai rendah tetapi ada beberapa nilai sangat tinggi.",
  "distribution": "Score Distribution",
  "perQuestion": "Per-Question Stats",
  "noData": "No data yet",
  "participants": "Participants",
  "answered": "Answered",
  "skipped": "Skipped",
  "mostSelected": "Most selected",
  "samples": "Sample answers"
}
idn['analytics'] = {
  "eyebrow": "Analitik",
  "title": "Analitik",
  "correctRate": "Benar",
  "wrongRate": "Salah",
  "scoreSummary": "Ringkasan Nilai",
  "average": "Rata-rata",
  "median": "Median",
  "aboveAverage": "Di Atas Rata-rata",
  "belowAverage": "Di Bawah Rata-rata",
  "summaryHint": "Rata-rata & median menunjukkan pusat nilai peserta. Median lebih kebal terhadap outlier (satu nilai ekstrem) daripada rata-rata: jika median jauh di bawah rata-rata, mayoritas peserta dapat nilai rendah tetapi ada beberapa nilai sangat tinggi.",
  "distribution": "Distribusi Nilai",
  "perQuestion": "Statistik Per Soal",
  "noData": "Belum ada data",
  "participants": "Peserta",
  "answered": "Terjawab",
  "skipped": "Tidak dijawab",
  "mostSelected": "Terbanyak dipilih",
  "samples": "Contoh jawaban"
}

json.dump(en, open('src/locales/en.json', 'w'), ensure_ascii=False, indent=2)
json.dump(idn, open('src/locales/id.json', 'w'), ensure_ascii=False, indent=2)

def ensure_hook(s):
    m = re.search(r"(export default function \w+\(\) \{\n)", s)
    if m and 'const { t } = useTranslation()' not in s:
        s = s.replace(m.group(1), m.group(1) + "  const { t } = useTranslation()\n", 1)
    if 'react-i18next' not in s:
        s = re.sub(r"(^import \{ useState[^\n]*\n)", r"import { useTranslation } from 'react-i18next'\n\1", s, count=1)
    return s

# ===== Results =====
p = 'src/pages/results/Results.jsx'
s = open(p).read()
pairs = [
    ('eyebrow="Responses"', "eyebrow={t('results.eyebrow')}"),
    ("title={formTitle || 'Results'}", "title={formTitle || t('results.title')}"),
    ('>{t("results.excel") if false ? "" : "Excel"}</Button>', '>{t("results.excel")}</Button>'),
    ('>Excel</Button>', '>{t("results.excel")}</Button>'),
    ("title=\"No submissions yet\"", "title={t('results.noSubmissions')}"),
    ('description="Share your form link to start receiving responses."', "description={t('results.noSubmissionsDesc')}"),
    ('>{selected.size} hasil dipilih</span>', '>{t("results.selected", { count: selected.size })}</span>'),
    ('>Hapus</Button>', '>{t("results.deleteSelected")}</Button>'),
    ('>Batal</Button>', '>{t("results.cancel")}</Button>'),
    ('>Previous</Button>', '>{t("forms.previous")}</Button>'),
    ('>Next</Button>', '>{t("forms.next")}</Button>'),
    ('>ID</th>', '>{t("results.id")}</th>'),
    ('>Rank</th>', '>{t("results.rank")}</th>'),
    ('>Respondent</th>', '>{t("results.respondent")}</th>'),
    ("{isQuiz ? 'Score / Max' : 'Answers'}", "{isQuiz ? t('results.score') : t('results.answers')}"),
    ('>Status</th>', '>{t("results.status")}</th>'),
    ('>Submitted</th>', '>{t("results.submitted")}</th>'),
    ('>(you)</span>', '>{t("results.you")}</span>'),
    ("title=\"Delete results?\"", "title={t('results.deleteConfirm')}"),
    ("message={`${selected.size} hasil terpilih akan dihapus permanen beserta seluruh jawabannya.`}", "message={t('results.deleteMsg', { count: selected.size })}"),
    ('confirmText="Hapus"', 'confirmText={t("results.deleteSelected")}'),
    ("title=\"Vonis curang?\"", "title={t('results.cheatConfirmTitle')}"),
    ("message={`Submission #${statusTarget?.id} akan diberi status Cheating dengan nilai 0.`}", "message={t('results.cheatConfirmMsg', { id: statusTarget?.id })}"),
    ('confirmText="Ya, nilai 0"', 'confirmText={t("results.cheatConfirmYes")}'),
    ("toast.success(res.data.message || 'Status diperbarui')", "toast.success(res.data.message || t('results.statusUpdated'))"),
    ("toast.error(err.response?.data?.message || 'Gagal mengubah status')", "toast.error(err.response?.data?.message || t('results.statusFailed'))"),
]
for a, b in pairs:
    s = s.replace(a, b)
# modal info
s = s.replace('>Informasi Ujian</h3>', '>{t("results.infoTitle")}</h3>')
s = s.replace('>Identitas Pengisi</p>', '>{t("results.identity")}</p>')
s = s.replace("{chip('Nama', respondent)}", "{chip(t('results.name'), respondent)}")
s = s.replace("{chip('Email', respondentEmail)}", "{chip(t('results.email'), respondentEmail)}")
s = s.replace('>{t("results.detail") if false ? "" : "Detail"}</p>', '>{t("results.detail")}</p>')
s = s.replace(">{t('results.detail') if false ? \"\" : \"Detail\"}</p>", '>{t("results.detail")}</p>')
s = s.replace(">{t('results.detail') || 'Detail'}</p>", '>{t("results.detail")}</p>')
s = s.replace(">Detail</p>", '>{t("results.detail")}</p>')
s = s.replace("{chip('Jumlah soal',", "{chip(t('results.questionCount'),")
s = s.replace("{chip('Waktu',", "{chip(t('results.time'),")
s = s.replace("{chip('Pengiriman',", "{chip(t('results.status'),")
s = s.replace("chip('Waktu', 'Tanpa batas')", "chip(t('results.time'), t('results.noLimit'))")
s = s.replace("chip('Pengiriman', 'Sekali saja')", "chip(t('results.status'), t('results.once'))")
s = s.replace("chip('Pengiriman', 'Bebas')", "chip(t('results.status'), t('results.unlimited'))")
s = s.replace("Terdeteksi curang — keluar tab/fullscreen", "{{t(detail.status === 'cheating' ? 'results.cheating' : 'results.cheatRecord')}}")
s = s.replace("Ada catatan pelanggaran (keluar tab/fullscreen)", "{{t('results.cheatRecord')}}")
s = s.replace("Pencatatan terakhir: {detail.cheat_reason}", "{{t('results.lastRecord')}}: {detail.cheat_reason}")
s = s.replace('>Loading...</div>', '>{t("results.loading")}</div>')
s = s.replace('>Belum ada soal.</div>', '>{t("results.noQuestions")}</div>')
s = s.replace('Jawaban pengisi · {detail.questions?.length ?? 0} pertanyaan', '{{t("results.answerSection")}} · {{detail.questions?.length ?? 0}} {{t("results.questions")}}')
s = s.replace('>{t("results.answer") if false ? "" : "Jawaban"}</span>', '>{t("results.answer")}</span>')
s = s.replace('>Jawaban</span>', '>{t("results.answer")}</span>')
s = s.replace('Lihat file jawaban</a>', '{t("results.viewFile")}</a>')
s = s.replace('title="Benar"', 'title={t("results.correct")}')
s = s.replace('title="Salah"', 'title={t("results.wrong")}')
s = s.replace("aria-label=\"Pilih semua\"", "aria-label={t('results.deleteSelected')}")
s = s.replace("aria-label={`Pilih #${row.submission_id}`}", "aria-label={`#${row.submission_id}`}")
s = ensure_hook(s)
open(p, 'w').write(s)

# ===== Analytics =====
p = 'src/pages/results/Analytics.jsx'
s = open(p).read()
pairs = [
    ('eyebrow="Insights"', "eyebrow={t('analytics.eyebrow')}"),
    ('title="Analytics"', "title={t('analytics.title')}"),
    ('label="Correct"', 'label={t("analytics.correctRate")}'),
    ('label="Wrong"', 'label={t("analytics.wrongRate")}'),
    ('>Score Summary</h2>', '>{t("analytics.scoreSummary")}</h2>'),
    ('>Average</p>', '>{t("analytics.average")}</p>'),
    ('>Median</p>', '>{t("analytics.median")}</p>'),
    ('>Above Average</p>', '>{t("analytics.aboveAverage")}</p>'),
    ('>Below Average</p>', '>{t("analytics.belowAverage")}</p>'),
    ('Rata-rata & median menunjukkan pusat nilai peserta. Median lebih kebal terhadap outlier (satu nilai ekstrem) daripada rata-rata: jika median jauh di bawah rata-rata, mayoritas peserta dapat nilai rendah tetapi ada beberapa nilai sangat tinggi.', '{{t("analytics.summaryHint")}}'),
    ('>Per-Question Stats</h2>', '>{t("analytics.perQuestion")}</h2>'),
    ('>No data yet</p>', '>{t("analytics.noData")}</p>'),
]
for a, b in pairs:
    s = s.replace(a, b)
s = ensure_hook(s)
open(p, 'w').write(s)

print('batch results/analytics ok')
