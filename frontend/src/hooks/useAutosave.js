import { useRef, useState, useCallback } from 'react'
import api from '../api/client'
import { sessionTokenHeaders } from '../lib/sessionToken'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * useAutosave — debounce 500ms + retry exponential backoff untuk autosave.
 * Status per pertanyaan: 'saving' | 'saved' | 'error' | null (idle).
 */
export function useAutosave({ submissionId, onExpired }) {
  const timers = useRef({})
  const [statuses, setStatuses] = useState({})

  const setStatus = useCallback((qId, status) => {
    setStatuses((prev) => ({ ...prev, [qId]: status }))
  }, [])

  const flush = useCallback(async (qId, payload) => {
    const attempt = async (retriesLeft = 2) => {
      try {
        const res = await api.patch(`/submissions/${submissionId}/autosave`, payload, { headers: sessionTokenHeaders(submissionId) })
        if (res.status === 410 || (res.data && res.data.detail && String(res.data.detail).toLowerCase().includes('expired'))) {
          onExpired?.()
          return
        }
        setStatus(qId, 'saved')
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
        setStatus(qId, 'error')
        throw err
      }
    }
    await attempt()
  }, [submissionId, onExpired, setStatus])

  const save = useCallback((qId, value) => {
    clearTimeout(timers.current[qId])
    setStatus(qId, 'saving')
    timers.current[qId] = setTimeout(() => {
      const payload = Array.isArray(value)
        ? { question_id: qId, option_ids: value }
        : { question_id: qId, answer_text: value }
      flush(qId, payload)
    }, 500)
  }, [flush, setStatus])

  const flushAll = useCallback(async (answers) => {
    const tasks = Object.entries(answers).map(([qId, value]) => {
      clearTimeout(timers.current[qId])
      const payload = Array.isArray(value)
        ? { question_id: Number(qId), option_ids: value }
        : { question_id: Number(qId), answer_text: value }
      return flush(qId, payload)
    })
    await Promise.all(tasks)
  }, [flush])

  const clearTimers = useCallback(() => {
    Object.values(timers.current).forEach((t) => clearTimeout(t))
    timers.current = {}
  }, [])

  return { statuses, save, flushAll, clearTimers }
}
