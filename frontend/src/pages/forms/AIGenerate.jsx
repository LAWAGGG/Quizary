import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUp, Paperclip, Sparkles, Check, X, FileText, Clock, Shuffle, Lock, ListChecks, Trophy, EyeOff, CalendarDays, Info, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { stripTags } from '../../lib/sanitize'
import { Button, Card, RichTextEditor, RichText, Badge, Toggle, Select, Input, AnswerKeyEditor } from '../../components/ui'

const humanizeType = (t) => (t || '').replace(/_/g, ' ')

const ACCEPT_EXT = '.docx,.pdf,.ppt,.pptx'
const MAX_FILES = 5
const PROMPT_MAX = 5000
const PROMPT_MIN = 10
const MAX_PREV_PROMPTS = 5
const normPrompt = (s) => String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

function QuotaPill({ quota }) {
  const { t } = useTranslation()
  if (!quota) return null
  const empty = quota.remaining <= 0
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border ${empty ? 'bg-incorrect-soft text-incorrect border-incorrect/20' : 'bg-primary-50 text-primary-700 border-primary/20 dark:bg-primary-900/20 dark:text-primary-300'}`}>
      <Sparkles className="w-3.5 h-3.5" />
      {t('aiGenerate.quotaLeft', { remaining: quota.remaining, limit: quota.limit })}
    </span>
  )
}

function SettingChips({ settings }) {
  const { t } = useTranslation()
  if (!settings) return null
  const chips = []
  if (settings.timer_minutes) chips.push({ icon: <Clock className="w-3.5 h-3.5" />, label: t('aiGenerate.timer', { minutes: settings.timer_minutes }) })
  if (settings.shuffle_questions) chips.push({ icon: <Shuffle className="w-3.5 h-3.5" />, label: t('aiGenerate.shuffleQ') })
  if (settings.shuffle_options) chips.push({ icon: <Shuffle className="w-3.5 h-3.5" />, label: t('aiGenerate.shuffleO') })
  if (settings.require_login) chips.push({ icon: <Lock className="w-3.5 h-3.5" />, label: t('aiGenerate.requireLogin') })
  chips.push({ icon: <ListChecks className="w-3.5 h-3.5" />, label: settings.submission_limit === 'once' ? t('aiGenerate.limitOnce') : t('aiGenerate.limitUnlimited') })
  if (settings.show_leaderboard) chips.push({ icon: <Trophy className="w-3.5 h-3.5" />, label: t('aiGenerate.leaderboard') })
  if (settings.is_restricted) chips.push({ icon: <Lock className="w-3.5 h-3.5" />, label: t('aiGenerate.restricted') })
  if (!settings.reveal_score) chips.push({ icon: <EyeOff className="w-3.5 h-3.5" />, label: t('aiGenerate.revealScore') })
  if (!settings.reveal_answers) chips.push({ icon: <EyeOff className="w-3.5 h-3.5" />, label: t('aiGenerate.revealAnswers') })
  if (settings.scoring_mode === 'manual') chips.push({ icon: <ListChecks className="w-3.5 h-3.5" />, label: t('aiGenerate.scoringManual') })
  if (settings.starts_at || settings.ends_at) chips.push({ icon: <CalendarDays className="w-3.5 h-3.5" />, label: [settings.starts_at?.slice(0, 10), settings.ends_at?.slice(0, 10)].filter(Boolean).join(' → ') })

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-medium bg-gray-100 dark:bg-ink-800 text-gray-600 dark:text-gray-300">
          {c.icon}{c.label}
        </span>
      ))}
    </div>
  )
}

function IgnoredBox({ items }) {
  const { t } = useTranslation()
  if (!items?.length) return null
  return (
    <div className="rounded-xl border border-warn/30 bg-warn-soft dark:bg-warn-soft px-4 py-3 flex gap-2.5" role="status">
      <Info className="w-4 h-4 text-warn shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink dark:text-gray-100">{t('aiGenerate.ignoredTitle')}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('aiGenerate.ignoredDesc')}</p>
        <p className="text-xs font-medium text-ink dark:text-gray-200 mt-1">{items.join(' · ')}</p>
      </div>
    </div>
  )
}

function CountWarnBox({ items }) {
  const { t } = useTranslation()
  if (!items?.length) return null
  return (
    <div className="rounded-xl border border-warn/30 bg-warn-soft dark:bg-warn-soft px-4 py-3 flex gap-2.5" role="status">
      <Info className="w-4 h-4 text-warn shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{t('aiGenerate.countWarnTitle')}</p>
        <p className="text-xs text-ink mt-0.5">{t('aiGenerate.countWarnDesc')}</p>
        {items.map((w, i) => (
          <p key={i} className="text-xs font-medium text-ink mt-1">{w}</p>
        ))}
      </div>
    </div>
  )
}

function SettingRow({ title, desc, control }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink dark:text-gray-100">{title}</p>
        {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

// Titik-titik loading ala chat di dalam komposer saat generate/edit.
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}

// Skeleton question card yang bertambah satu-per-satu (pengganti modal loading).
function SkeletonCards({ count }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-ink-900 p-4 space-y-3 animate-pulse">
          <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-5/6 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-8 flex-1 rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

// datetime-local butuh "YYYY-MM-DDTHH:MM"; backend kirim ISO detik — potong menit.
const toInputDateTime = (v) => (v ? String(v).slice(0, 16) : '')

export default function AIGenerate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef(null)
  const composerRef = useRef(null)

  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formType, setFormType] = useState('form')
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState([])
  const [quota, setQuota] = useState(null)
  const [draft, setDraft] = useState(null)
  const [ignored, setIgnored] = useState([])
  const [warnings, setWarnings] = useState([])
  const [modelUsed, setModelUsed] = useState('')
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [genProgress, setGenProgress] = useState({ percent: 0, key: '', done: 0, total: 0 })
  const [skeletonCount, setSkeletonCount] = useState(0)
  // Riwayat prompt tersembunyi (tak dirender) — konteks anti-halusinasi untuk /ai/edit.
  const [prevPrompts, setPrevPrompts] = useState([])
  const abortRef = useRef(null)
  const tickRef = useRef(null)
  const cancelledRef = useRef(false)

  // Edit lock anti race-condition: komposer dikunci selama busy,
  // instruksi ke-2 diblokir sampai request pertama done/gagal/cancel.
  const busy = generating || editing

  useEffect(() => {
    api.get('/ai/quota').then((r) => setQuota(r.data)).catch(() => {})
  }, [])

  // Skeleton tumbuh satu-per-satu saat generate pertama (belum ada draf).
  useEffect(() => {
    if (!generating) { setSkeletonCount(0); return }
    setSkeletonCount(1)
    const id = setInterval(() => setSkeletonCount((c) => (c >= 8 ? c : c + 1)), 600)
    return () => clearInterval(id)
  }, [generating])

  const steps = [
    { id: 1, label: t('aiGenerate.stepShape'), desc: t('aiGenerate.stepShapeDesc') },
    { id: 2, label: t('aiGenerate.stepPrompt'), desc: t('aiGenerate.stepPromptDesc') },
    { id: 3, label: t('aiGenerate.stepPolish'), desc: t('aiGenerate.stepPolishDesc') },
  ]

  const goToPrompt = () => {
    if (!stripTags(title)) { setError(t('aiGenerate.titleRequired')); return }
    setError('')
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const canGoTo = (id) => {
    if (busy) return false
    if (id === step) return false
    if (id === 1 || id === 2) return true
    return !!draft
  }

  const goToStep = (id) => {
    if (!canGoTo(id)) return
    if (step === 1 && id === 2) { goToPrompt(); return }
    setError('')
    setStep(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const patchSettings = (patch) => setDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d))

  // Ubah 1 soal dalam draf (si/qi = indeks section/question).
  const patchQuestion = (si, qi, patch) => setDraft((d) => {
    if (!d) return d
    return {
      ...d,
      sections: d.sections.map((s, i) => (i !== si ? s : {
        ...s,
        questions: s.questions.map((q, j) => (j !== qi ? q : { ...q, ...patch })),
      })),
    }
  })

  // Mirror rantai backend: restricted ⇒ once ⇒ require_login.
  const toggleDraft = (key, value) => {
    if (key === 'is_restricted' && value) {
      patchSettings({ is_restricted: true, submission_limit: 'once', require_login: true })
    } else if (key === 'submission_limit' && value === 'once') {
      patchSettings({ submission_limit: 'once', require_login: true })
    } else {
      patchSettings({ [key]: value })
    }
  }

  const addFiles = (list) => {
    if (draft) return
    const incoming = Array.from(list || [])
    if (!incoming.length) return
    const allowed = ACCEPT_EXT.split(',').map((s) => s.trim().toLowerCase())
    const valid = []
    let rejected = 0
    for (const f of incoming) {
      const ext = `.${String(f.name || '').split('.').pop().toLowerCase()}`
      if (allowed.includes(ext)) valid.push(f)
      else rejected += 1
    }
    if (rejected) toast.error(t('aiGenerate.invalidFile', { count: rejected }))
    const room = MAX_FILES - files.length
    if (room <= 0) {
      if (valid.length) toast.error(t('aiGenerate.filesFull'))
      return
    }
    if (valid.length > room) toast.error(t('aiGenerate.filesFull'))
    const take = valid.slice(0, room)
    if (take.length) setFiles((prev) => [...prev, ...take].slice(0, MAX_FILES))
  }

  const pickFiles = (e) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)

  // Cegah browser membuka file bila di-drop di luar komposer.
  useEffect(() => {
    const stop = (e) => e.preventDefault()
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  const onComposerDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    setDragActive(true)
  }
  const onComposerDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragActive(false)
    }
  }
  const onComposerDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const onComposerDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setDragActive(false)
    addFiles(e.dataTransfer?.files)
  }

  const stopTick = () => { clearInterval(tickRef.current); tickRef.current = null }
  const startTick = () => {
    stopTick()
    tickRef.current = setInterval(() => {
      setGenProgress((p) => (p.key === 'generating' && p.percent < 90 ? { ...p, percent: p.percent + 1 } : p))
    }, 2000)
  }

  // Batalkan generate/edit: putus koneksi. Generate dibatalkan sebelum
  // done = tanpa kuota; edit dibatalkan sebelum server commit = tanpa kuota.
  // Tanpa error merah — cukup toast info.
  const cancelBusy = () => {
    cancelledRef.current = true
    abortRef.current?.abort()
  }

  const applyDone = (data, usedPrompt) => {
    setDraft(data.draft)
    setIgnored(data.ignored || [])
    setWarnings(data.warnings || [])
    setModelUsed(data.model || '')
    setQuota((q) => (q ? { ...q, remaining: data.remaining, used: q.limit - data.remaining } : q))
    setGenProgress({ percent: 100, key: '', done: 0, total: 0 })
    if (usedPrompt) setPrevPrompts((prev) => [...prev, usedPrompt].slice(-MAX_PREV_PROMPTS))
    setPrompt('')
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const failGenerate = (status, serverMsg, fallbackCode) => {
    let msg
    if (status === 429) msg = serverMsg || t('aiGenerate.quotaEmpty')
    else if (status === 502 && serverMsg?.toLowerCase().includes('terpotong')) msg = serverMsg
    else if (fallbackCode === 'ECONNABORTED') msg = t('aiGenerate.timeout')
    else msg = serverMsg || t('aiGenerate.generateFailed')
    setError(typeof msg === 'string' ? msg : t('aiGenerate.generateFailed'))
    toast.error(serverMsg || msg)
  }

  const failEdit = (status, serverMsg, fallbackCode) => {
    let msg
    if (status === 429) msg = serverMsg || t('aiGenerate.quotaEmpty')
    else if (fallbackCode === 'ECONNABORTED') msg = t('aiGenerate.timeout')
    else msg = serverMsg || t('aiGenerate.editFailed')
    setError(typeof msg === 'string' ? msg : t('aiGenerate.editFailed'))
    toast.error(serverMsg || msg)
  }

  // Generate via SSE stream (fetch + getReader; axios tak bisa stream).
  // Fallback ke endpoint non-stream bila respons bukan event-stream.
  const streamGenerate = async (fd, signal, usedPrompt) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${api.defaults.baseURL}/ai/generate/stream`, {
      method: 'POST',
      body: fd,
      signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'ngrok-skip-browser-warning': 'true',
      },
    })
    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('text/event-stream')) {
      const res2 = await api.post('/ai/generate', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 })
      applyDone(res2.data, usedPrompt)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    const onEvent = (event, data) => {
      if (event === 'progress') {
        if (data.stage === 'reading') {
          const total = data.total || 0
          const done = data.done || 0
          setGenProgress({ percent: total ? 10 + Math.round((30 * done) / total) : 10, key: 'reading', done, total })
        } else if (data.stage === 'generating') {
          setGenProgress({ percent: 50, key: 'generating', done: 0, total: 0 })
          startTick()
        } else if (data.stage === 'sanitizing') {
          stopTick()
          setGenProgress({ percent: 92, key: 'sanitizing', done: 0, total: 0 })
        }
      } else if (event === 'done') {
        stopTick()
        applyDone(data, usedPrompt)
        return true
      } else if (event === 'error') {
        stopTick()
        failGenerate(data.status, data.message)
        return true
      }
      return false
    }
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      let finished = false
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        let event = null
        const dataLines = []
        for (const line of block.split('\n')) {
          if (line.startsWith(':')) continue
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (!event || !dataLines.length) continue
        let data = null
        try { data = JSON.parse(dataLines.join('\n')) } catch { continue }
        if (onEvent(event, data)) { finished = true; break }
      }
      if (finished) { reader.cancel().catch(() => {}); break }
    }
  }

  const handleGenerate = async (e) => {
    e?.preventDefault()
    if (busy) return
    if (!stripTags(title)) { setError(t('aiGenerate.titleRequired')); setStep(1); return }
    const clean = normPrompt(prompt)
    if (clean.length < PROMPT_MIN) { setError(t('aiGenerate.promptMin', { current: clean.length, max: PROMPT_MAX })); return }
    if (clean.length > PROMPT_MAX) { setError(t('aiGenerate.promptMax', { current: clean.length, max: PROMPT_MAX })); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    cancelledRef.current = false
    setGenerating(true)
    setError('')
    setGenProgress({ percent: 5, key: 'reading', done: 0, total: 0 })
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('description', description || '')
      fd.append('type', formType)
      fd.append('prompt', prompt)
      files.forEach((f) => fd.append('files', f))
      await streamGenerate(fd, abortRef.current.signal, clean)
    } catch (err) {
      if (cancelledRef.current || err?.name === 'AbortError' || err?.name === 'CanceledError') {
        toast.info(t('aiGenerate.generateCancelled'))
      } else {
        const status = err.response?.status
        const serverMsg = err.response?.data?.message || err.response?.data?.detail
        failGenerate(status, serverMsg, err.code)
      }
    } finally {
      stopTick()
      setGenerating(false)
    }
  }

  // Edit via prompt: kirim draf JSON + instruksi + riwayat prompt tersembunyi.
  // Makan 1 kuota. Draf lama utuh bila gagal.
  const handleEdit = async (e) => {
    e?.preventDefault()
    if (busy || !draft) return
    const instruction = normPrompt(prompt)
    if (instruction.length < PROMPT_MIN) { setError(t('aiGenerate.promptMin', { current: instruction.length, max: PROMPT_MAX })); return }
    if (instruction.length > PROMPT_MAX) { setError(t('aiGenerate.promptMax', { current: instruction.length, max: PROMPT_MAX })); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    cancelledRef.current = false
    setEditing(true)
    setError('')
    try {
      const res = await api.post('/ai/edit', {
        title,
        type: formType,
        instruction,
        draft,
        previous_prompts: prevPrompts,
      }, { signal: abortRef.current.signal, timeout: 180000 })
      applyDone(res.data, instruction)
      toast.success(t('aiGenerate.editSuccess'))
    } catch (err) {
      if (cancelledRef.current || err?.name === 'AbortError' || err?.name === 'CanceledError' || err.response?.status === 499) {
        toast.info(t('aiGenerate.editCancelled'))
      } else {
        const status = err.response?.status
        const serverMsg = err.response?.data?.message || err.response?.data?.detail
        failEdit(status, serverMsg, err.code)
      }
    } finally {
      setEditing(false)
    }
  }

  // Bersihkan interval + stream bila user pindah halaman saat proses jalan.
  useEffect(() => () => { stopTick(); abortRef.current?.abort() }, [])

  const genStageText =
    genProgress.key === 'reading' ? t('aiGenerate.overlayReading')
    : genProgress.key === 'generating' ? t('aiGenerate.overlayGenerating')
    : genProgress.key === 'sanitizing' ? t('aiGenerate.overlaySanitizing')
    : ''
  const busyStatus = generating ? genStageText : t('aiGenerate.editing')

  const handleAccept = async () => {
    if (busy || accepting || !draft) return
    if (!stripTags(title)) { setError(t('aiGenerate.titleRequired')); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setAccepting(true)
    setError('')
    try {
      const s = draft.settings
      const res = await api.post('/ai/accept', {
        title,
        description: description || null,
        type: formType,
        settings: { ...s },
        // Kunci kosong (cuma spasi) dinull-kan agar lolos min_length backend.
        sections: draft.sections.map((sec) => ({
          ...sec,
          questions: sec.questions.map((q) => ({
            ...q,
            answer_key: (q.answer_key || '').trim() || null,
          })),
        })),
      })
      toast.success(t('aiGenerate.accepted'))
      navigate(`/forms/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.message || t('aiGenerate.acceptFailed'))
      toast.error(err.response?.data?.message || t('aiGenerate.acceptFailed'))
    } finally {
      setAccepting(false)
    }
  }

  // Generate ulang dari awal: buang draf, kembalikan prompt asli ke komposer.
  // User kirim ulang = panggil /ai/generate (1 kuota baru).
  const handleFreshRegen = () => {
    if (busy) return
    setDraft(null)
    setIgnored([])
    setWarnings([])
    setModelUsed('')
    setError('')
    setPrompt(prevPrompts[0] || '')
    setStep(2)
    setTimeout(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  const quotaEmpty = quota && quota.remaining <= 0
  const promptLen = normPrompt(prompt).length
  const promptOver = promptLen > PROMPT_MAX
  const canGenerate = !busy && !quotaEmpty && promptLen >= PROMPT_MIN && !promptOver && !!stripTags(title)
  const promptEmpty = promptLen === 0
  const canEdit = !!draft && !busy && !quotaEmpty && !promptEmpty && promptLen >= PROMPT_MIN && !promptOver

  const handleComposerKey = (e) => {
    if (e.key !== 'Enter') return
    // Modifier + Enter selalu menambah baris; Enter polos mengirim.
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
      e.preventDefault()
      const field = e.currentTarget
      const start = field.selectionStart
      const end = field.selectionEnd
      const next = `${prompt.slice(0, start)}\n${prompt.slice(end)}`
      setPrompt(next)
      requestAnimationFrame(() => {
        field.selectionStart = start + 1
        field.selectionEnd = start + 1
      })
      return
    }
    e.preventDefault()
    if (busy) return
    if (!draft && canGenerate) handleGenerate()
    else if (draft && canEdit) handleEdit()
  }

  const handlePrimaryButton = () => {
    if (busy) return
    if (!draft) { handleGenerate(); return }
    if (promptEmpty) handleAccept()
    else handleEdit()
  }

  const primaryDisabled = !draft ? !canGenerate : promptEmpty ? (busy || accepting || !stripTags(title)) : !canEdit
  const primaryLabel = !draft ? t('aiGenerate.generate') : promptEmpty ? t('aiGenerate.accept') : t('aiGenerate.sendEdit')

  const isCompact = busy
  const composer = (
    <motion.div
      ref={composerRef}
      layout
      transition={{ layout: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }}
      onDragEnter={onComposerDragEnter}
      onDragLeave={onComposerDragLeave}
      onDragOver={onComposerDragOver}
      onDrop={onComposerDrop}
      aria-busy={busy}
      data-testid="ai-composer"
      className={`relative rounded-[1.75rem] border bg-white shadow-lift will-change-transform dark:bg-ink-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 dark:focus-within:border-primary dark:focus-within:ring-primary/20 transition-[padding,border-color,box-shadow,background-color] duration-300 ease-out ${dragActive && !isCompact ? 'border-primary ring-4 ring-primary/15' : 'border-primary-100 dark:border-gray-700'} ${isCompact ? 'flex items-center gap-2 py-2 pl-3 pr-2' : 'p-4'}`}
    >
      {dragActive && !isCompact && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-primary bg-primary-50/90 backdrop-blur-sm dark:bg-primary-950/90" aria-hidden>
          <Paperclip className="h-6 w-6 text-primary-600 dark:text-primary-300" />
          <p className="text-sm font-semibold text-primary-700 dark:text-primary-200">{t('aiGenerate.dropFiles')}</p>
        </div>
      )}

      {/* Compact 1-line bar saat generating/editing: input + cancel sejajar, tanpa Paperclip, minim tinggi */}
      {isCompact ? (
        <div className="flex w-full items-center gap-2 min-w-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-primary-600 dark:text-primary-300" role="status">
            <TypingDots />
          </span>
          <span className="sm:hidden inline-flex shrink-0" role="status" aria-label={busyStatus}><TypingDots /></span>
          <input
            value={prompt.replace(/\s+/g, ' ')}
            readOnly
            placeholder={busyStatus}
            aria-label={t('aiGenerate.promptLabel')}
            tabIndex={-1}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[14px] leading-5 text-ink placeholder:text-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder:text-gray-500 truncate"
          />
          <button
            type="button"
            onClick={cancelBusy}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-gray-100 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-200 hover:text-ink dark:bg-ink-800 dark:text-gray-300 dark:hover:bg-ink-700 transition-colors active:scale-95"
          >
            {t('aiGenerate.cancelGenerate')}
          </button>
        </div>
      ) : (
        <>
          {!draft && files.length > 0 && (
            <div className="mb-3 mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-2 rounded-full bg-primary-50 py-1.5 pl-3 pr-1.5 text-xs font-medium text-primary-700 dark:bg-primary-900/25 dark:text-primary-300">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] truncate" title={f.name}>{f.name.split(/\s+/).slice(0, 3).join(' ')}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={t('aiGenerate.removeFile')}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-primary-400 transition-colors hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            id="ai-prompt"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setError('') }}
            onKeyDown={handleComposerKey}
            placeholder={draft ? t('aiGenerate.editPlaceholder') : t('aiGenerate.promptComposerPlaceholder')}
            rows={1}
            aria-busy={busy}
            className="w-full resize-none bg-transparent px-1 pb-14 text-[15px] leading-6 text-ink placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-transparent dark:text-gray-100 dark:placeholder:text-gray-500 [field-sizing:content] min-h-11 max-h-[200px]"
          />
          {promptOver && <p className="field-error mt-1">{t('aiGenerate.promptMax', { current: promptLen, max: PROMPT_MAX })}</p>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 rounded-b-[1.75rem] bg-gradient-to-t from-white via-white/100 to-transparent dark:from-ink-900 dark:via-ink-900/100" aria-hidden="true" />
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-2">
            {!draft && (
              <>
                <input ref={fileRef} type="file" multiple accept={ACCEPT_EXT} onChange={pickFiles} className="hidden outline-hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={files.length >= MAX_FILES}
                  aria-label={t('aiGenerate.filesLabel')}
                  title={t('aiGenerate.filesLabel')}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-primary-900/25 dark:hover:text-primary-300"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-400 dark:text-gray-500">{files.length}/{MAX_FILES} · {t('aiGenerate.filesHint')}</span>
              </>
            )}
            {draft && <span className="flex-1" />}
            <button
              type="button"
              onClick={handlePrimaryButton}
              disabled={primaryDisabled}
              aria-label={primaryLabel}
              title={primaryLabel}
              className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full text-white shadow-chip transition-all hover:from-primary-600 hover:to-primary-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 bg-gradient-to-br from-primary-500 to-primary-700 ${!draft || !promptEmpty ? 'h-11 w-11' : 'h-11 px-5 text-sm font-semibold'}`}
            >
              {!draft || !promptEmpty ? <ArrowUp className="h-5 w-5" strokeWidth={2.5} /> : <><Check className="h-4 w-4" />{t('aiGenerate.accept')}</>}
            </button>
          </div>
        </>
      )}
    </motion.div>
  )

  const stepper = (
    <div className={busy ? 'opacity-50 pointer-events-none' : ''}>
      <div className="relative flex items-center justify-between px-5" aria-hidden>
        <div className="absolute left-10 right-10 top-1/2 h-px -translate-y-1/2 bg-gray-200 dark:bg-gray-700" />
        <div
          className="absolute left-10 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
          style={{ width: `calc(${((step - 1) / (steps.length - 1)) * 100}% - ${((step - 1) / (steps.length - 1)) * 2.5}rem)` }}
        />
        {steps.map((item) => (
          <span
            key={item.id}
            className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums transition-colors ${
              step > item.id
                ? 'border-primary bg-primary text-white'
                : step === item.id
                  ? 'border-primary bg-white dark:bg-ink-900 text-primary'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 text-gray-400'
            }`}
          >
            {step > item.id ? <Check className="h-4 w-4" strokeWidth={3} /> : String(item.id).padStart(2, '0')}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {steps.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!canGoTo(item.id)}
            onClick={() => goToStep(item.id)}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              step === item.id
                ? 'border-primary bg-primary-50/60 dark:bg-primary-900/20'
                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-ink-900 opacity-70'
            } ${canGoTo(item.id) ? 'cursor-pointer hover:border-primary/50' : 'cursor-default'}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Step {item.id}</p>
            <p className="mt-1 text-sm font-semibold text-ink dark:text-gray-100">{item.label}</p>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/forms')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> {t('aiGenerate.back')}
      </button>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{t('aiGenerate.eyebrow')}</p>
          <QuotaPill quota={quota} />
        </div>

        {stepper}

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); goToPrompt() }} className="space-y-5">
            <Card className="space-y-5">
              <div>
                <span className="field-label">{t('aiGenerate.titleLabel')}</span>
                <RichTextEditor value={title} onChange={(html) => { setTitle(html); setError('') }} placeholder={t('aiGenerate.titlePlaceholder')} minHeight={60} />
              </div>
              <div>
                <span className="field-label">{t('aiGenerate.descLabel')}</span>
                <RichTextEditor value={description} onChange={setDescription} placeholder={t('aiGenerate.descPlaceholder')} minHeight={100} />
              </div>
              <div>
                <span className="field-label">{t('aiGenerate.typeLabel')}</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'form', label: t('aiGenerate.typeForm'), desc: t('aiGenerate.typeFormDesc') },
                    { value: 'quiz', label: t('aiGenerate.typeQuiz'), desc: t('aiGenerate.typeQuizDesc') },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setFormType(o.value)}
                      aria-pressed={formType === o.value}
                      className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${formType === o.value ? 'border-primary bg-primary-50 shadow-chip' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 hover:border-gray-300 dark:hover:border-gray-600'}`}
                    >
                      <span className={`block text-sm font-semibold ${formType === o.value ? 'text-primary-700' : 'text-ink dark:text-gray-100'}`}>{o.label}</span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            {error && <p className="field-error">{error}</p>}
            <Button type="submit" className="w-full" size="lg">
              {t('aiGenerate.nextPrompt')}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {busy && (
              <div aria-busy="true">
                <SkeletonCards count={skeletonCount} />
              </div>
            )}
            <div className={busy ? 'sticky bottom-[var(--mobile-nav-offset,4.5rem)] md:bottom-4 z-40 mt-2 pb-2' : ''}>{composer}</div>
            {!busy && (
              <>
                {error && <p className="field-error">{error}</p>}
                {quotaEmpty && <p className="field-error">{t('aiGenerate.quotaEmpty')}</p>}
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(1)}>{t('aiGenerate.back')}</Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-ink dark:text-gray-100">
                  {t('aiGenerate.stepPolish')}
                </h2>
                <div className="flex items-center gap-2">
                  {modelUsed && (
                    <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-ink-800 text-gray-500 dark:text-gray-400">
                      <Sparkles className="w-3 h-3" />{modelUsed}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleFreshRegen}
                    title={t('aiGenerate.freshRegenHint')}
                    className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-ink-800 text-gray-500 dark:text-gray-400 hover:text-primary-600 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />{t('aiGenerate.freshRegen')}
                  </button>
                </div>
              </div>
              <SettingChips settings={draft.settings} />
              <IgnoredBox items={ignored} />
              <CountWarnBox items={warnings} />
              <div>
                <span className="field-label">{t('aiGenerate.titleLabel')}</span>
                <RichTextEditor value={title} onChange={setTitle} minHeight={60} />
              </div>
              <div>
                <span className="field-label">{t('aiGenerate.descLabel')}</span>
                <RichTextEditor value={description} onChange={setDescription} minHeight={80} />
              </div>
            </Card>

            <Card className="space-y-1 divide-y divide-gray-100 dark:divide-gray-800">
              <div className="pb-2">
                <h3 className="font-display font-semibold text-ink dark:text-gray-100">{t('aiGenerate.settingsTitle')}</h3>
                <p className="field-hint mt-0.5">{t('aiGenerate.settingsHint')}</p>
              </div>
              <SettingRow title={t('aiGenerate.shuffleQ')} control={<Toggle label={t('aiGenerate.shuffleQ')} checked={!!draft.settings.shuffle_questions} onChange={(v) => toggleDraft('shuffle_questions', v)} />} />
              <SettingRow title={t('aiGenerate.shuffleO')} control={<Toggle label={t('aiGenerate.shuffleO')} checked={!!draft.settings.shuffle_options} onChange={(v) => toggleDraft('shuffle_options', v)} />} />
              <SettingRow title={t('aiGenerate.requireLogin')} control={<Toggle label={t('aiGenerate.requireLogin')} checked={!!draft.settings.require_login} onChange={(v) => toggleDraft('require_login', v)} />} />
              <SettingRow
                title={t('aiGenerate.limitOnce')}
                control={
                  <Toggle
                    label={t('aiGenerate.limitOnce')}
                    checked={draft.settings.submission_limit === 'once'}
                    onChange={(v) => toggleDraft('submission_limit', v ? 'once' : 'unlimited')}
                  />
                }
              />
              {formType === 'quiz' && (
                <>
                  <SettingRow title={t('aiGenerate.leaderboard')} control={<Toggle label={t('aiGenerate.leaderboard')} checked={!!draft.settings.show_leaderboard} onChange={(v) => toggleDraft('show_leaderboard', v)} />} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <Input label={t('aiGenerate.timerLabel')} type="number" min="1" max="1440" value={draft.settings.timer_minutes || ''} onChange={(e) => toggleDraft('timer_minutes', e.target.value ? Number(e.target.value) : null)} />
                    <Select label={t('aiGenerate.scoringMode')} value={draft.settings.scoring_mode || 'auto'} onChange={(e) => toggleDraft('scoring_mode', e.target.value)}>
                      <option value="auto">{t('aiGenerate.scoringAuto')}</option>
                      <option value="manual">{t('aiGenerate.scoringManual')}</option>
                    </Select>
                  </div>
                </>
              )}
              <SettingRow title={t('aiGenerate.restricted')} control={<Toggle label={t('aiGenerate.restricted')} checked={!!draft.settings.is_restricted} onChange={(v) => toggleDraft('is_restricted', v)} />} />
              <SettingRow title={t('aiGenerate.history')} control={<Toggle label={t('aiGenerate.history')} checked={draft.settings.show_in_history !== false} onChange={(v) => toggleDraft('show_in_history', v)} />} />
              {formType === 'quiz' && (
                <>
                  <SettingRow title={t('aiGenerate.revealScore')} control={<Toggle label={t('aiGenerate.revealScore')} checked={draft.settings.reveal_score !== false} onChange={(v) => toggleDraft('reveal_score', v)} />} />
                  <SettingRow title={t('aiGenerate.revealAnswers')} control={<Toggle label={t('aiGenerate.revealAnswers')} checked={draft.settings.reveal_answers !== false} onChange={(v) => toggleDraft('reveal_answers', v)} />} />
                </>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <Input label={t('aiGenerate.startsAt')} type="datetime-local" value={toInputDateTime(draft.settings.starts_at)} onChange={(e) => toggleDraft('starts_at', e.target.value || null)} />
                <Input label={t('aiGenerate.endsAt')} type="datetime-local" value={toInputDateTime(draft.settings.ends_at)} onChange={(e) => toggleDraft('ends_at', e.target.value || null)} helper={t('aiGenerate.scheduleHint')} />
              </div>
            </Card>

            <div className={editing ? 'opacity-60 pointer-events-none select-none' : ''} aria-busy={editing}>
              {draft.sections.map((sec, si) => (
                <Card key={si} className="space-y-3">
                  <h3 className="font-display font-semibold text-ink dark:text-gray-100">{si + 1}. {sec.title}</h3>
                  {sec.questions.map((q, qi) => (
                    <div key={qi} data-qi={`${si}-${qi}`} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge scheme="blue">{humanizeType(q.type)}</Badge>
                        {q.is_required && <span className="text-incorrect font-bold">*</span>}
                        {q.points > 0 && <span className="text-xs text-gray-400">{t('aiGenerate.points', { points: q.points })}</span>}
                      </div>
                      <div className="text-sm text-ink dark:text-gray-100"><RichText html={q.question_text} className="rich-text block" /></div>
                      {q.options?.length > 0 && (
                        <ul className="space-y-1">
                          {q.options.map((o, oi) => (
                            <li key={oi} className={`flex items-start gap-2 text-sm px-2.5 py-1.5 rounded-lg ${o.is_correct ? 'bg-correct-soft text-correct font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                              {o.is_correct ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <span className="w-4 h-4 shrink-0 mt-0.5 text-center leading-4 text-gray-300">·</span>}
                              <span className="flex-1 min-w-0 [&>p]:mb-0"><RichText html={o.option_text} className="rich-text" /></span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
                        <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                          <Toggle
                            label={t('aiGenerate.allowOther')}
                            checked={!!q.allow_other}
                            onChange={(v) => patchQuestion(si, qi, { allow_other: v })}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm text-gray-600 dark:text-gray-400">{t('aiGenerate.allowOther')}</span>
                            <span className="block text-xs text-gray-400 dark:text-gray-500">{t('aiGenerate.allowOtherHint')}</span>
                          </span>
                        </label>
                      )}
                        {formType === 'quiz' && (q.type === 'essay' || q.type === 'short_answer') && (
                         <div className="pt-1">
                           <AnswerKeyEditor
                             value={q.answer_key || ''}
                             onChange={(value) => patchQuestion(si, qi, { answer_key: value })}
                           />
                         </div>
                       )}
                    </div>
                  ))}
                </Card>
              ))}
            </div>

            {error && <p className="field-error">{error}</p>}

            <div className="sticky bottom-[var(--mobile-nav-offset,4.5rem)] md:bottom-4 z-40 mt-2 pb-2">{composer}</div>
          </div>
        )}
      </motion.div>
    </div>
  )
}