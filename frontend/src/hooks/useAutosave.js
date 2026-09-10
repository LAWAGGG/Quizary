import { useRef, useState, useCallback } from 'react'
import api from '../api/client'
import { sessionTokenHeaders } from '../lib/sessionToken'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const draftKey = (sid) => `quizary_draft_${sid}`

/**
 * Draft offline — jaring pengaman untuk jawaban yang belum sempat sampai ke
 * server (internet mati, tab ditutup sebelum autosave berhasil). Disimpan per
 * submission_id sehingga anonim maupun login dilayani jalur yang sama.
 * Entri dihapus begitu tersimpan ke server; seluruh kunci dihapus saat sesi
 * selesai (clearDraft). Tidak punya TTL — persisten sampai salah satu itu.
 */
export function loadDraft(submissionId) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(submissionId))) || {}
  } catch {
    return {}
  }
}

export function clearDraft(submissionId) {
  try {
    localStorage.removeItem(draftKey(submissionId))
  } catch {}
}

/**
 * useAutosave — debounce 500ms + retry exponential backoff untuk autosave.
 * Status per pertanyaan: 'saving' | 'saved' | 'error' | null (idle).
 * flushAll: bulk 1 request (PATCH /autosave/bulk) + onlyUnsaved + 30s guard
 * untuk fokus/online — cegah N×PATCH sekuensial tiap alt-tab.
 */
export function useAutosave({ submissionId, onExpired }) {
  const timers = useRef({})
  const [statuses, setStatuses] = useState({})
  const statusesRef = useRef({})
  const lastBulkAtRef = useRef(0)

  const setStatus = useCallback((qId, status) => {
    const key = String(qId)
    if (status == null) delete statusesRef.current[key]
    else statusesRef.current[key] = status
    setStatuses((prev) => {
      if (status == null) {
        const n = { ...prev }
        delete n[key]
        delete n[qId]
        return n
      }
      return { ...prev, [qId]: status, [key]: status }
    })
  }, [])

  const dropDraftEntry = useCallback((qId) => {
    try {
      const all = loadDraft(submissionId)
      delete all[qId]
      delete all[String(qId)]
      if (Object.keys(all).length) localStorage.setItem(draftKey(submissionId), JSON.stringify(all))
      else localStorage.removeItem(draftKey(submissionId))
    } catch {}
  }, [submissionId])

  // Nilai jawaban: array (option_ids) | string (answer_text) | object
  // {ids, text} (opsi + teks "Lainnya"). Objek dipertahankan apa adanya
  // agar draft/restore tidak kehilangan separuh jawaban campuran.
  const toPayload = (qId, value) => {
    if (Array.isArray(value)) return { question_id: Number(qId), option_ids: value }
    if (value && typeof value === 'object') {
      return { question_id: Number(qId), option_ids: value.ids || [], answer_text: value.text ?? null }
    }
    return { question_id: Number(qId), answer_text: value }
  }

  const draftValue = (payload) => {
    if (Array.isArray(payload.option_ids)) {
      return payload.answer_text != null
        ? { ids: payload.option_ids, text: payload.answer_text }
        : payload.option_ids
    }
    return payload.answer_text
  }

  const isEmptyValue = (value) => Array.isArray(value)
    ? !value.length
    : (value && typeof value === 'object'
      ? !(value.ids || []).length && !String(value.text || '').trim()
      : !value)

  const stashDraft = useCallback((qId, payload) => {
    try {
      const all = loadDraft(submissionId)
      const value = draftValue(payload)
      // Nilai kosong tidak distash — menghindari menghidupkan jawaban yang
      // memang sengaja dikosongkan user saat offline.
      if (isEmptyValue(value)) dropDraftEntry(qId)
      else {
        all[qId] = { value, ts: Date.now() }
        localStorage.setItem(draftKey(submissionId), JSON.stringify(all))
      }
    } catch {} // storage penuh/blocked — autosave server tetap jalan
  }, [submissionId, dropDraftEntry])

  const flush = useCallback(async (qId, payload) => {
    const attempt = async (retriesLeft = 2) => {
      try {
        const res = await api.patch(`/submissions/${submissionId}/autosave`, payload, { headers: sessionTokenHeaders(submissionId) })
        if (res.status === 410 || (res.data && res.data.detail && String(res.data.detail).toLowerCase().includes('expired'))) {
          onExpired?.()
          return
        }
        setStatus(qId, 'saved')
        dropDraftEntry(qId)
      } catch (err) {
        if (err.response?.status === 410) {
          onExpired?.()
          return
        }
        const retryable = !err.response || err.response.status >= 500
        if (retryable && retriesLeft > 0) {
          await sleep(400 * (3 - retriesLeft))
          return attempt(retriesLeft - 1)
        }
        setStatus(qId, 'error') // draft lokal dipertahankan sebagai cadangan
        throw err
      }
    }
    await attempt()
  }, [submissionId, onExpired, setStatus, dropDraftEntry])

  const save = useCallback((qId, value) => {
    clearTimeout(timers.current[qId])
    clearTimeout(timers.current[String(qId)])
    setStatus(qId, 'saving')
    const payload = toPayload(qId, value)
    stashDraft(qId, payload)
    timers.current[qId] = setTimeout(() => {
      flush(qId, payload)
    }, 500)
  }, [flush, setStatus, stashDraft])

  const flushAll = useCallback(async (answers, opts = {}) => {
    const onlyUnsaved = !!opts.onlyUnsaved
    let entries = Object.entries(answers).filter(([, v]) => {
      // skip empty to avoid pointless PATCH
      if (Array.isArray(v)) return v.length > 0
      if (v && typeof v === 'object') return (v.ids || []).length > 0 || String(v.text || '').trim()
      return !!v
    })
    if (!entries.length) return
    if (onlyUnsaved) {
      entries = entries.filter(([qId]) => statusesRef.current[String(qId)] !== 'saved' && statusesRef.current[qId] !== 'saved')
      if (!entries.length) return
      // Guard: jangan bulk tiap focus jika baru saja sukses <30s dan tidak ada error/draft
      const now = Date.now()
      const hasError = entries.some(([qId]) => statusesRef.current[String(qId)] === 'error' || statusesRef.current[qId] === 'error')
      let hasDraft = false
      try {
        const d = loadDraft(submissionId)
        hasDraft = entries.some(([qId]) => d[qId] != null || d[String(qId)] != null)
      } catch {}
      if (!hasError && !hasDraft && now - lastBulkAtRef.current < 30000) return
    }
    for (const [qId] of entries) {
      clearTimeout(timers.current[qId])
      clearTimeout(timers.current[String(qId)])
    }
    const payload = { answers: entries.map(([qId, value]) => toPayload(qId, value)) }

    const attemptBulk = async (retriesLeft = 1) => {
      try {
        const res = await api.patch(`/submissions/${submissionId}/autosave/bulk`, payload, { headers: sessionTokenHeaders(submissionId) })
        if (res.status === 410 || String(res.data?.detail || '').toLowerCase().includes('expired')) {
          onExpired?.()
          return true
        }
        for (const [qId] of entries) {
          setStatus(qId, 'saved')
          dropDraftEntry(qId)
        }
        lastBulkAtRef.current = Date.now()
        return true
      } catch (err) {
        if (err.response?.status === 410) {
          onExpired?.()
          return true
        }
        const retryable = !err.response || err.response.status >= 500
        if (retryable && retriesLeft > 0) {
          await sleep(400)
          return attemptBulk(retriesLeft - 1)
        }
        // 422/409/404 — biar fallback sekuensial coba per-item (satu item jelek tidak block semua)
        return false
      }
    }

    const ok = await attemptBulk()
    if (ok) return
    // Fallback: sekuensial per-item (valid item tetap tersimpan)
    for (const [qId, value] of entries) {
      try {
        await flush(Number(qId), toPayload(Number(qId), value))
      } catch {
        console.warn('flushAll skip', qId)
      }
    }
    lastBulkAtRef.current = Date.now()
  }, [flush, submissionId, onExpired, setStatus, dropDraftEntry])

  const clearTimers = useCallback(() => {
    Object.values(timers.current).forEach((t) => clearTimeout(t))
    timers.current = {}
  }, [])

  return { statuses, save, flushAll, clearTimers }
}
