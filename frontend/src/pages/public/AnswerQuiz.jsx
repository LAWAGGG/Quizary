import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Timer, ChevronLeft, ChevronRight, Grid3x3, Flag, CheckCheck, AlertTriangle } from 'lucide-react'
import { Button, Input, Textarea, Card, FallbackPage, QuestionMap, ConfirmSubmitModal } from '../../components/ui'
import { useAutosave } from '../../hooks/useAutosave'
import { themePalette } from '../../lib/theme'
import api from '../../api/client'

const OPT_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981']
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function parseDate(str) {
  if (!str) return null
  const [d, m, Y, H, M, S] = str.split(/[\s:-]+/).map(Number)
  // API times are WIB (UTC+7). Build the absolute instant from WIB components
  // so the countdown is correct regardless of the viewer's browser timezone.
  return new Date(Date.UTC(Y, m - 1, d, (H || 0) - 7, M || 0, S || 0))
}

function OptionTile({ letter, color, selected, checkbox, children, onClick, disabled, image }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative py-4 px-4 rounded-2xl font-medium text-white text-center min-h-[88px] flex items-center gap-3 transition-all ${selected ? 'ring-2 ring-white ring-offset-2 shadow-lift scale-[1.02]' : 'shadow hover:brightness-110 active:brightness-95'
        }`}
      style={{ backgroundColor: color }}
    >
      {checkbox ? (
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors ${selected ? 'bg-white' : 'bg-white/25'
          }`}>
          {selected && <Check className="w-4 h-4 text-[var(--t,#6C5CE7)]" strokeWidth={3.5} />}
        </span>
      ) : (
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/25 font-mono font-bold text-sm shrink-0">
          {letter}
        </span>
      )}
      {image && (
        <img src={image.path} alt="" className="max-h-24 w-auto rounded-lg object-contain shrink-0" />
      )}
      {children ? <span className="flex-1 leading-snug text-left">{children}</span> : null}

      {!children && !image && <span className="flex-1" />}
      {selected && !checkbox && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

export default function AnswerQuiz() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(window.location.search)
  const formType = searchParams.get('type') || 'form'
  const formTitle = searchParams.get('title') || 'Form'
  const formCode = searchParams.get('code') || ''

  const [data, setData] = useState(null)
  const [publicForm, setPublicForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitError, setSubmitError] = useState(null)   // inline error, tidak redirect ke FallbackPage
  const [validationErrors, setValidationErrors] = useState({})  // { [qId]: true } soal required kosong
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [reviewed, setReviewed] = useState({})
  const [showMap, setShowMap] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [direction, setDirection] = useState(1)
  const [cheatWarn, setCheatWarn] = useState(null)

  const timerRef = useRef(null)
  const questionRefs = useRef({})   // { [qId]: HTMLElement } untuk scroll ke soal bermasalah

  const goToResult = useCallback(() => {
    // Keluar dari fullscreen saat selesai (semua jalur: submit, timeout, cheating).
    const ex = document.exitFullscreen || document.webkitExitFullscreen
    if (ex) Promise.resolve(ex.call(document)).catch(() => { })
    navigate(`/s/${submissionId}/result?type=${formType}&title=${encodeURIComponent(formTitle)}&code=${formCode}`, { replace: true })
  }, [submissionId, navigate, formType, formTitle, formCode])

  const onExpired = useCallback(() => {
    setTimeLeft(0)
    goToResult()
  }, [goToResult])

  const reportTabExit = useCallback(async (reason = '') => {
    // Fullscreen anti-cheat: every detected violation reports to the server,
    // which owns the penalty. The 3rd violation auto-submits with 0 + 'cheating'.
    try {
      const res = await api.post(`/submissions/${submissionId}/tab-exit`, reason ? { reason } : undefined)
      const d = res.data
      if (d.status === 'cheating' || d.warnings_left === 0) {
        goToResult()
      } else {
        setCheatWarn({ left: d.warnings_left, reason, at: Date.now() })
      }
    } catch (err) {
      if (err.response?.status === 410) goToResult()
    }
  }, [submissionId, goToResult])

  const { statuses, save, flushAll, clearTimers } = useAutosave({ submissionId, onExpired })

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}`)
      const d = res.data
      if (d.status === 'submitted' || d.status === 'auto_submitted') {
        goToResult()
        return
      }
      setData(d)
      const ans = {}
      d.answers.forEach((a) => {
        if (a.question_type === 'short_answer' || a.question_type === 'essay') {
          ans[a.question_id] = a.answer_text || ''
        } else {
          ans[a.question_id] = a.selected_option_ids || []
        }
      })
      setAnswers(ans)

      if (d.expired_at) {
        const deadline = parseDate(d.expired_at)
        if (deadline) setTimeLeft(deadline.getTime() - Date.now())
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied')
      } else {
        setError(err.response?.data?.message || 'Failed to load')
      }
    } finally {
      setLoading(false)
    }
  }, [submissionId, goToResult])

  useEffect(() => {
    fetchSubmission()
  }, [fetchSubmission])

  useEffect(() => {
    if (!formCode) return
    api.get(`/q/${formCode}`)
      .then((res) => setPublicForm(res.data))
      .catch(() => { })
  }, [formCode])

  const handleAutoSubmit = useCallback(async () => {
    try {
      // Flush jawaban yang masih dalam debounce agar tidak hilang saat auto-submit.
      await flushAll(answers)
      await api.post(`/submissions/${submissionId}/submit`)
      goToResult()
    } catch (err) {
      if (err.response?.status === 410) {
        goToResult()
      } else {
        setError(err.response?.data?.message || err.response?.data?.detail || 'Gagal mengirim jawaban')
      }
    }
  }, [submissionId, goToResult, flushAll, answers])

  useEffect(() => {
    if (!data || formType !== 'quiz' || !data.expired_at) return
    const deadline = parseDate(data.expired_at)
    if (!deadline) return

    timerRef.current = setInterval(() => {
      const diff = deadline.getTime() - Date.now()
      if (diff <= 0) {
        clearInterval(timerRef.current)
        setTimeLeft(0)
        handleAutoSubmit()
      } else {
        setTimeLeft(diff)
      }
    }, 1000)

    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, formType, data?.expired_at, handleAutoSubmit])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  useEffect(() => {
    if (formType !== 'quiz' || !publicForm?.is_restricted || !data) return
    // Fullscreen langsung, tanpa tombol. requestFullscreen() butuh user gesture,
    // jadi dipicu ulang otomatis pada sentuhan/klik/tekan pertama di halaman kuis.
    const requestFs = () => {
      const el = document.documentElement
      const req = el.requestFullscreen || el.webkitRequestFullscreen
      if (req && !(document.fullscreenElement || document.webkitFullscreenElement)) {
        Promise.resolve(req.call(el)).catch(() => { })
      }
    }
    requestFs()
    document.addEventListener('pointerdown', requestFs, { once: true })
    document.addEventListener('keydown', requestFs, { once: true })
    return () => {
      document.removeEventListener('pointerdown', requestFs)
      document.removeEventListener('keydown', requestFs)
    }
  }, [formType, publicForm?.is_restricted, data])

  // Fullscreen anti-cheat (is_restricted quiz). Detects and reports every
  // cheating vector — tab/app switched, fullscreen exited, split-screen,
  // floating window/PiP, print, devtools/shortcuts, right-click, copy.
  // Debounced so the simultaneous blur + visibilitychange + resize burst that
  // fires on a single "leave" isn't double-counted as multiple violations.
  useEffect(() => {
    if (formType !== 'quiz' || !publicForm?.is_restricted || !data) return
    let lastAt = 0
    const MIN_GAP = 1200
    const report = (reason) => {
      const now = Date.now()
      if (now - lastAt < MIN_GAP) return
      lastAt = now
      reportTabExit(reason)
    }

    const inFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement

    const onFsChange = () => {
      if (!inFullscreen()) report('left-fullscreen')
    }
    const onVis = () => { if (document.visibilityState === 'hidden') report('tab-hidden') }
    const onBlur = () => report('window-blur')

    // Split-screen / floating window: only meaningful while fullscreen is ON —
    // in fullscreen the content should cover the whole screen, so any large
    // shrink means the app was split, resized, or another app floated over it.
    // The soft keyboard is handled by visualViewport, not window resize.
    let shrinkTimer = null
    const onResize = () => {
      if (!inFullscreen()) return
      if (window.screen.height - window.innerHeight > 120) {
        clearTimeout(shrinkTimer)
        shrinkTimer = setTimeout(() => report('split-screen'), 300)
      }
    }

    const beforePrint = () => report('print')
    const onPiP = () => report('picture-in-picture')
    const onContext = (e) => { e.preventDefault(); report('context-menu') }
    const onCopy = () => report('copy')
    const onKey = (e) => {
      const k = (e.key || '').toLowerCase()
      const blocked =
        e.key === 'F12' ||
        e.key === 'PrintScreen' || e.key === 'PrtScn' ||
        (e.ctrlKey && ['p', 'u', 's', 'a'].includes(k)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k))
      if (blocked) {
        e.preventDefault()
        report('shortcut')
      }
    }

    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onResize)
    window.addEventListener('beforeprint', beforePrint)
    document.addEventListener('enterpictureinpicture', onPiP)
    document.addEventListener('contextmenu', onContext)
    document.addEventListener('copy', onCopy)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('beforeprint', beforePrint)
      document.removeEventListener('enterpictureinpicture', onPiP)
      document.removeEventListener('contextmenu', onContext)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('keydown', onKey)
      clearTimeout(shrinkTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formType, publicForm?.is_restricted, data, reportTabExit])

  // Auto-dismiss the cheat warning banner after a few seconds.
  useEffect(() => {
    if (!cheatWarn) return
    const t = setTimeout(() => setCheatWarn(null), 5000)
    return () => clearTimeout(t)
  }, [cheatWarn])

  // Keyboard navigation (quiz mode): 1-4 pilih opsi, ←/→ ganti soal, Enter next/submit
  useEffect(() => {
    if (formType !== 'quiz' || !data) return
    const qs = data.questions || []
    const cur = qs[currentIdx]
    if (!cur || showConfirm || showMap) return
    const curAnswer = answers[cur.id]
    const hasAns = Array.isArray(curAnswer) ? curAnswer.length > 0 : curAnswer?.length > 0
    const isReq = cur.is_required !== false
    const canGo = !isReq || hasAns
    const isLast = currentIdx === qs.length - 1

    const handler = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); if (!isLast) handleNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev() }
      else if (e.key === 'Enter') {
        e.preventDefault()
        if (isLast) { if (canGo) openConfirm() } else if (canGo) handleNext()
      }
      else if (/^[1-4]$/.test(e.key) && (cur.type === 'multiple_choice' || cur.type === 'checkbox')) {
        const opt = cur.options[Number(e.key) - 1]
        if (opt) handleSelect(cur.id, opt.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formType, data, currentIdx, answers, showConfirm, showMap, reviewed])

  const handleSelect = (qId, optId) => {
    const question = data.questions.find((q) => q.id === qId)
    if (!question) return

    if (question.type === 'multiple_choice') {
      setAnswers((a) => {
        const next = a[qId]?.[0] === optId ? [] : [optId]
        save(qId, next)
        return { ...a, [qId]: next }
      })
    } else if (question.type === 'checkbox') {
      setAnswers((a) => {
        const prev = a[qId] || []
        const next = prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
        save(qId, next)
        return { ...a, [qId]: next }
      })
    }
    // Clear validation error for this question once user picks an answer
    if (validationErrors[qId]) {
      setValidationErrors((e) => { const n = { ...e }; delete n[qId]; return n })
    }
  }

  const handleTextChange = (qId, value) => {
    setAnswers((a) => ({ ...a, [qId]: value }))
    save(qId, value)
    // Clear validation error once user starts typing
    if (validationErrors[qId] && value.trim()) {
      setValidationErrors((e) => { const n = { ...e }; delete n[qId]; return n })
    }
  }

  const toggleReview = (qId) => {
    setReviewed((r) => ({ ...r, [qId]: !r[qId] }))
  }

  const handleNext = () => {
    if (!data) return
    if (currentIdx < data.questions.length - 1) {
      setDirection(1)
      setCurrentIdx((i) => i + 1)
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setDirection(-1)
      setCurrentIdx((i) => i - 1)
    }
  }

  const goToQuestion = (idx) => {
    setDirection(idx > currentIdx ? 1 : -1)
    setCurrentIdx(idx)
  }

  const handleSubmitAll = async () => {
    if (submitting) return

    // Frontend validation — cek semua soal required sebelum kirim ke backend
    const isAnsweredCheck = (val) => Array.isArray(val) ? val.length > 0 : !!val && val.trim().length > 0
    const errors = {}
    let firstErrorIdx = -1
    const qs = data?.questions || []
    qs.forEach((q, idx) => {
      if (q.is_required !== false && !isAnsweredCheck(answers[q.id])) {
        errors[q.id] = true
        if (firstErrorIdx === -1) firstErrorIdx = idx
      }
    })

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      setSubmitError(null)
      // Scroll ke soal required pertama yang belum dijawab
      const firstQ = qs[firstErrorIdx]
      if (firstQ && questionRefs.current[firstQ.id]) {
        questionRefs.current[firstQ.id].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return // Jangan kirim ke backend
    }

    setValidationErrors({})
    setSubmitError(null)
    setSubmitting(true)
    try {
      await flushAll(answers)
      await api.post(`/submissions/${submissionId}/submit`)
      goToResult()
    } catch (err) {
      if (err.response?.status === 410) {
        goToResult()
      } else {
        const msg = err.response?.data?.message || err.response?.data?.detail || 'Failed to submit your answers'
        setShowConfirm(false)
        // Submit error ditampilkan inline, BUKAN redirect ke FallbackPage
        setSubmitError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const openConfirm = () => {
    setShowConfirm(true)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (error) {
    return (
      <FallbackPage
        title="Oops"
        message={error}
        action={<Button variant="secondary" onClick={() => navigate('/')} className="w-full">Go home</Button>}
      />
    )
  }

  if (!data) return null

  const isQuiz = formType === 'quiz'
  const palette = themePalette(publicForm?.theme_color)
  const bannerPath = publicForm?.banner_path || null
  const questions = data.questions || []
  const current = questions[currentIdx]
  const totalQ = questions.length

  // Helper shared by both quiz and form modes
  const isAnswered = (val) => Array.isArray(val) ? val.length > 0 : !!val && val.trim().length > 0

  if (isQuiz) {
    const currentAnswer = answers[current?.id]
    const hasAnswer = Array.isArray(currentAnswer) ? currentAnswer.length > 0 : currentAnswer?.length > 0
    const isRequired = current?.is_required !== false
    const isLast = currentIdx === totalQ - 1
    const progress = totalQ > 0 ? ((currentIdx + 1) / totalQ) * 100 : 0
    const canProceed = !isRequired || hasAnswer
    const answeredMap = {}
    const reviewedMap = {}
    questions.forEach((q, i) => {
      answeredMap[i] = isAnswered(answers[q.id])
      reviewedMap[i] = !!reviewed[q.id]
    })
    const reviewedCount = Object.values(reviewed).filter(Boolean).length
    const missingRequired = questions
      .filter((q) => q.is_required !== false && !isAnswered(answers[q.id]))
      .map((q) => q.question_text)
    const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length

    const formatTime = (ms) => {
      if (ms <= 0) return '00:00'
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
      <div className="theme-surface h-dvh flex flex-col bg-paper" style={{ '--t': palette.base }}>
        {cheatWarn && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] max-w-lg"
          >
            <div className="flex items-start gap-3 bg-incorrect text-white px-4 py-3.5 rounded-2xl shadow-lift">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Aktivitas mencurigakan terdeteksi ({cheatWarn.reason || 'keluar halaman'}).</p>
                <p className="text-white/85 mt-0.5">
                  Peringatan {3 - cheatWarn.left}/2. Melanjutkan akan mengumpulkan jawaban otomatis dengan nilai 0.
                </p>
              </div>
            </div>
          </motion.div>
        )}
        <header className="px-4 py-3" style={{ background: palette.gradient }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-white truncate mx-2">{formTitle}</span>
            <div className="flex items-center gap-2">
              {current && (
                <SaveIndicator status={statuses[current.id]} />
              )}
              {timeLeft !== null && (
                <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums px-2.5 h-8 rounded-lg transition-colors ${timeLeft < 30000
                  ? 'bg-incorrect text-white animate-pulse'
                  : timeLeft < 60000
                    ? 'bg-white text-incorrect'
                    : 'bg-white/15 text-white'
                  }`}>
                  <Timer className="w-3.5 h-3.5" />
                  {formatTime(timeLeft)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold shrink-0 px-2 h-8 rounded-lg transition-colors ${showMap ? 'bg-white text-primary' : 'text-white/80 hover:bg-white/15'
                }`}
              aria-label="Show question map"
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              {currentIdx + 1}/{totalQ}
            </button>
          </div>
        </header>

        {showMap && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-b border-gray-200 px-4 py-4"
          >
            <div className="max-w-lg mx-auto">
              <QuestionMap total={totalQ} current={currentIdx} answered={answeredMap} reviewed={reviewedMap} onSelect={goToQuestion} />
              <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-gray-400">
                <Legend dot="bg-correct" label="Answered" />
                <Legend dot="bg-warn" label="Marked" />
                <Legend dot="bg-white border border-gray-300" label="Unanswered" />
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <AnimatePresence mode="wait" custom={direction}>            <motion.div
            key={current?.id}
            custom={direction}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -60, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {current && (
              <div className="max-w-lg mx-auto">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    {current.is_required === false ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary-50 px-2 py-0.5 rounded-full">Required</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleReview(current.id)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 h-8 rounded-lg transition-colors ${reviewed[current.id] ? 'bg-warn text-white shadow-chip' : 'bg-white text-gray-400 border border-gray-200 hover:text-warn hover:border-warn'
                      }`}
                    aria-pressed={!!reviewed[current.id]}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {reviewed[current.id] ? 'Marked' : 'Mark for review'}
                  </button>
                </div>
                <h2 className="font-display text-xl font-bold text-ink text-center mb-2">{current.question_text}</h2>
                {current.image && (
                  <img src={current.image.path} alt="" className="max-h-52 w-auto mx-auto rounded-2xl object-cover mb-4 shadow-card" />
                )}
                {current.type === 'multiple_choice' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400 text-center mb-2">Pick one answer</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {current.options.map((opt, i) => {
                        const selected = (answers[current.id] || []).includes(opt.id)
                        return (
                          <OptionTile
                            key={opt.id}
                            letter={LETTERS[i % LETTERS.length]}
                            color={OPT_COLORS[i % OPT_COLORS.length]}
                            selected={selected}
                            onClick={() => handleSelect(current.id, opt.id)}
                            image={opt.image}
                          >
                            {opt.option_text}
                          </OptionTile>
                        )
                      })}
                    </div>
                  </div>
                )}

                {current.type === 'checkbox' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400 text-center mb-2">Pick all that apply</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {current.options.map((opt, i) => {
                        const selected = (answers[current.id] || []).includes(opt.id)
                        return (
                          <OptionTile
                            key={opt.id}
                            letter={LETTERS[i % LETTERS.length]}
                            color={OPT_COLORS[i % OPT_COLORS.length]}
                            selected={selected}
                            checkbox
                            onClick={() => handleSelect(current.id, opt.id)}
                            image={opt.image}
                          >
                            {opt.option_text}
                          </OptionTile>
                        )
                      })}
                    </div>
                  </div>
                )}

                {current.type === 'short_answer' && (
                  <div className="mt-4">
                    <Input
                      value={answers[current.id] || ''}
                      onChange={(e) => handleTextChange(current.id, e.target.value)}
                      className="text-center text-lg h-14"
                      placeholder="Tap to answer"
                    />
                  </div>
                )}

                {current.type === 'essay' && (
                  <div className="mt-4">
                    <Textarea
                      value={answers[current.id] || ''}
                      onChange={(e) => handleTextChange(current.id, e.target.value)}
                      className="min-h-[180px] text-base leading-relaxed"
                      placeholder="Write your answer here..."
                      rows={6}
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>
          </AnimatePresence>
        </div>

        <footer className="px-4 py-4 bg-white border-t border-gray-200">
          <div className="max-w-lg mx-auto flex gap-3">
            {currentIdx > 0 && (
              <Button variant="secondary" onClick={handlePrev} className="flex-1" icon={<ChevronLeft className="w-4 h-4" />}>
                Previous
              </Button>
            )}
            {isLast ? (
              <Button
                onClick={openConfirm}
                disabled={submitting || !canProceed}
                loading={submitting}
                className="flex-1"
                style={{ background: palette.cta, color: palette.onBase }}
                icon={!submitting && <Check className="w-4 h-4" />}
              >
                {canProceed ? 'Submit' : 'Answer to submit'}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed} className="flex-1" style={{ background: palette.cta, color: palette.onBase }}>
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
          {!isLast && !canProceed && (
            <p className="text-center text-xs text-gray-400 mt-2">Jawab dulu untuk lanjut (soal wajib)</p>
          )}
        </footer>

        <ConfirmSubmitModal
          show={showConfirm}
          title="Submit your answers?"
          answeredCount={answeredCount}
          totalCount={totalQ}
          missing={missingRequired}
          reviewedCount={reviewedCount}
          onConfirm={handleSubmitAll}
          onCancel={() => setShowConfirm(false)}
          loading={submitting}
          confirmText="Submit Now"
        />
      </div>
    )
  }

  return (
    <div className="theme-surface min-h-dvh bg-paper" style={{ background: palette.pageBg, '--t': palette.base }}>
      <div className="max-w-lg mx-auto p-4 pb-28">
        {bannerPath && (
          <img src={bannerPath} alt="" className="w-full h-40 object-cover rounded-3xl mb-6 shadow-card" />
        )}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-ink">{formTitle}</h1>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{totalQ} questions</span>
        </div>
        <div className="space-y-5">
          {questions.map((q) => (
            <Card
              key={q.id}
              ref={(el) => { if (el) questionRefs.current[q.id] = el }}
              data-question-id={q.id}
              className="p-5"
              style={{
                borderColor: validationErrors[q.id] ? '#EF4444' : palette.border,
                borderWidth: validationErrors[q.id] ? '2px' : undefined,
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-1">
                  <p className="font-semibold text-ink leading-snug">{q.question_text}</p>
                  {q.is_required !== false && (
                    <span className="text-[10px] font-semibold text-gray-400 mt-0.5 block">Required</span>
                  )}
                </div>
              </div>
              {validationErrors[q.id] && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  This question is required
                </p>
              )}
              {q.image && (
                <img src={q.image.path} alt="" className="max-h-52 w-auto mx-auto rounded-2xl object-cover mb-4 shadow-card" />
              )}

              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => {
                    const selected = (answers[q.id] || []).includes(opt.id)
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected ? 'border-primary bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        style={selected ? { borderColor: palette.base, backgroundColor: palette.soft } : undefined}
                      >
                        <span
                          className={`bubble w-6 h-6 text-xs ${selected ? 'bubble-selected' : 'bubble-empty'}`}
                          style={selected ? { borderColor: palette.base, backgroundColor: palette.base, color: palette.onBase } : undefined}
                        >
                          {LETTERS[i % LETTERS.length]}
                        </span>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={selected}
                          onChange={() => handleSelect(q.id, opt.id)}
                          className="sr-only"
                        />
                        <span className="text-sm text-ink">{opt.option_text}</span>
                        {opt.image && (
                          <img src={opt.image.path} alt="" className="max-h-20 w-auto rounded-lg object-contain shrink-0" />
                        )}
                      </label>
                    )
                  })}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const selected = (answers[q.id] || []).includes(opt.id)
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected ? 'border-primary bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        style={selected ? { borderColor: palette.base, backgroundColor: palette.soft } : undefined}
                      >
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-md border-2 shrink-0 transition-colors ${selected ? '' : 'border-gray-300 bg-white'
                            }`}
                          style={selected ? { borderColor: palette.base, backgroundColor: palette.base, color: palette.onBase } : undefined}
                        >
                          {selected && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleSelect(q.id, opt.id)}
                          className="sr-only"
                        />
                        <span className="text-sm text-ink">{opt.option_text}</span>
                        {opt.image && (
                          <img src={opt.image.path} alt="" className="max-h-20 w-auto rounded-lg object-contain shrink-0" />
                        )}
                      </label>
                    )
                  })}
                </div>
              )}

              {q.type === 'short_answer' && (
                <Input
                  value={answers[q.id] || ''}
                  onChange={(e) => handleTextChange(q.id, e.target.value)}
                  placeholder="Your answer"
                />
              )}

              {q.type === 'essay' && (
                <Textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleTextChange(q.id, e.target.value)}
                  className="min-h-[120px]"
                  rows={4}
                  placeholder="Write your answer..."
                />
              )}
            </Card>
          ))}
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-lg mx-auto">
          {submitError && (
            <p className="text-sm text-red-500 text-center mb-2 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {submitError}
            </p>
          )}
          {(() => {
            const unansweredCount = questions.filter(
              (q) => q.is_required !== false && !isAnswered(answers[q.id])
            ).length
            return (
              <>
                <Button
                  onClick={handleSubmitAll}
                  disabled={submitting || unansweredCount > 0}
                  loading={submitting}
                  className="w-full"
                  size="lg"
                  style={{ background: palette.cta, color: palette.onBase }}
                >
                  {unansweredCount > 0
                    ? `${unansweredCount} required question${unansweredCount > 1 ? 's' : ''} unanswered`
                    : 'Submit'}
                </Button>
              </>
            )
          })()}
        </div>
      </footer>
    </div>
  )
}

function SaveIndicator({ status }) {
  if (!status) return null
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Saving…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/85">
        <CheckCheck className="w-3.5 h-3.5" />
        Saved
      </span>
    )
  }
  if (status === 'error') {
    return <span className="inline-flex items-center text-[11px] font-semibold text-white/70">Not saved — retrying</span>
  }
  return null
}

function Legend({ dot, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
