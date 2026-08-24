/**
 * Penyimpanan token kepemilikan sesi pengerjaan (submission).
 *
 * Backend mengeluarkan `access_token` saat sesi dibuat/di-resume; token ini
 * wajib dikirim sebagai header X-Submission-Token pada endpoint autosave,
 * submit, tab-exit, upload file jawaban, dan detail submission.
 */
const KEY = 'quizary_session_tokens'
const MAX_ENTRIES = 20

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

export function saveSessionToken(submissionId, token) {
  if (!submissionId || !token) return
  const all = readAll()
  all[String(submissionId)] = token
  const ids = Object.keys(all)
  if (ids.length > MAX_ENTRIES) {
    for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete all[id]
  }
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function sessionTokenHeaders(submissionId) {
  if (!submissionId) return {}
  const token = readAll()[String(submissionId)]
  return token ? { 'X-Submission-Token': token } : {}
}
