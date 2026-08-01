import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Timer, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input, Textarea, Card, FallbackPage } from '../../components/ui'
import { themePalette } from '../../lib/theme'
import api from '../../api/client'

const OPT_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981']
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function parseDate(str) {
  if (!str) return null
  const [d, m, Y, H, M, S] = str.split(/[\s:-]+/).map(Number)
  return new Date(Y, m - 1, d, H, M, S)
}

function OptionTile({ letter, color, selected, checkbox, children, onClick, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative py-4 px-4 rounded-2xl font-medium text-white text-center min-h-[88px] flex items-center gap-3 transition-all ${
        selected ? 'ring-2 ring-white ring-offset-2 shadow-lift scale-[1.02]' : 'shadow hover:brightness-110 active:brightness-95'
      }`}
      style={{ backgroundColor: color }}
    >
      {checkbox ? (
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors ${
          selected ? 'bg-white' : 'bg-white/25'
        }`}>
          {selected && <Check className="w-4 h-4 text-[var(--t,#6C5CE7)]" strokeWidth={3.5} />}
        </span>
      ) : (
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/25 font-mono font-bold text-sm shrink-0">
          {letter}
        </span>
      )}
      <span className="flex-1 leading-snug">{children}</span>
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
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [direction, setDirection] = useState(1)

  const saveTimer = useRef(null)
  const timerRef = useRef(null)

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}`)
      const d = res.data
      if (d.status === 'submitted' || d.status === 'auto_submitted') {
        navigate(`/s/${submissionId}/result?type=${formType}&title=${encodeURIComponent(formTitle)}&code=${formCode}`, { replace: true })
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
  }, [submissionId, navigate, formType, formTitle, formCode])

  useEffect(() => {
    fetchSubmission()
  }, [fetchSubmission])

  useEffect(() => {
    if (!formCode) return
    api.get(`/q/${formCode}`)
      .then((res) => setPublicForm(res.data))
      .catch(() => {})
  }, [formCode])

  const handleAutoSubmit = useCallback(async () => {
    try {
      await api.post(`/submissions/${submissionId}/submit`)
      navigate(`/s/${submissionId}/result?type=${formType}&title=${encodeURIComponent(formTitle)}&code=${formCode}`, { replace: true })
    } catch {
      // ignore
    }
  }, [submissionId, navigate, formType, formTitle, formCode])

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

  const debouncedSave = useCallback((qId, value) => {
    clearTimeout(saveTimer.current)
    setSaving((s) => ({ ...s, [qId]: true }))
    saveTimer.current = setTimeout(async () => {
      try {
        const payload = Array.isArray(value)
          ? { question_id: qId, option_ids: value }
          : { question_id: qId, answer_text: value }
        await api.patch(`/submissions/${submissionId}/autosave`, payload)
        setSaving((s) => ({ ...s, [qId]: false }))
      } catch (err) {
        setSaving((s) => ({ ...s, [qId]: false }))
        if (err.response?.status === 410) {
          navigate(`/s/${submissionId}/result?type=${formType}&title=${encodeURIComponent(formTitle)}&code=${formCode}`, { replace: true })
        }
      }
    }, 500)
  }, [submissionId, navigate, formType, formTitle, formCode])

  useEffect(() => {
    return () => clearTimeout(saveTimer.current)
  }, [])

  const handleSelect = (qId, optId) => {
    const question = data.questions.find((q) => q.id === qId)
    if (!question) return

    if (question.type === 'multiple_choice') {
      const next = answers[qId]?.[0] === optId ? [] : [optId]
      setAnswers((a) => ({ ...a, [qId]: next }))
      debouncedSave(qId, next)
    } else if (question.type === 'checkbox') {
      const prev = answers[qId] || []
      const next = prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      setAnswers((a) => ({ ...a, [qId]: next }))
      debouncedSave(qId, next)
    }
  }

  const handleTextChange = (qId, value) => {
    setAnswers((a) => ({ ...a, [qId]: value }))
    debouncedSave(qId, value)
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

  const handleSubmitAll = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await Promise.all(
        Object.entries(answers).map(([qId, value]) => {
          const payload = Array.isArray(value)
            ? { question_id: Number(qId), option_ids: value }
            : { question_id: Number(qId), answer_text: value }
          return api.patch(`/submissions/${submissionId}/autosave`, payload)
        })
      )
      await api.post(`/submissions/${submissionId}/submit`)
      navigate(`/s/${submissionId}/result?type=${formType}&title=${encodeURIComponent(formTitle)}&code=${formCode}`, { replace: true })
    } catch (err) {
      if (err.response?.status === 410) {
        navigate(`/s/${submissionId}/result?type=${formType}&title=${encodeURIComponent(formTitle)}&code=${formCode}`, { replace: true })
      } else {
        setError('Failed to submit your answers')
      }
    } finally {
      setSubmitting(false)
    }
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

  if (isQuiz) {
    const answered = answers[current?.id]
    const hasAnswer = Array.isArray(answered) ? answered.length > 0 : answered?.length > 0
    const isLast = currentIdx === totalQ - 1
    const progress = totalQ > 0 ? ((currentIdx + 1) / totalQ) * 100 : 0

    const formatTime = (ms) => {
      if (ms <= 0) return '00:00'
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
      <div className="theme-surface h-dvh flex flex-col bg-paper" style={{ '--t': palette.base }}>
        <header className="px-4 py-3" style={{ background: palette.gradient }}>
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-white truncate mx-2">{formTitle}</span>
            <div className="flex items-center gap-2.5">
              {saving[current?.id] && (
                <svg className="w-4 h-4 text-white/60 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {timeLeft !== null && (
                <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums px-2.5 h-8 rounded-lg ${
                  timeLeft < 60000 ? 'bg-white text-incorrect' : 'bg-white/15 text-white'
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
            <span className="text-xs font-mono font-bold text-white/70 shrink-0 tabular-nums">
              {currentIdx + 1}/{totalQ}
            </span>
          </div>
        </header>

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
                {current.type === 'multiple_choice' && (
                  <div className="space-y-4">
                    <h2 className="font-display text-xl font-bold text-ink text-center mb-2">{current.question_text}</h2>
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
                    <h2 className="font-display text-xl font-bold text-ink text-center mb-2">{current.question_text}</h2>
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
                    <h2 className="font-display text-xl font-bold text-ink text-center mb-6">{current.question_text}</h2>
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
                    <h2 className="font-display text-xl font-bold text-ink text-center mb-6">{current.question_text}</h2>
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
              <Button onClick={handleSubmitAll} disabled={submitting} loading={submitting} className="flex-1" style={{ background: palette.cta, color: palette.onBase }} icon={!submitting && <Check className="w-4 h-4" />}>
                Submit
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!hasAnswer} className="flex-1" style={{ background: palette.cta, color: palette.onBase }}>
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </footer>
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
            <Card key={q.id} className="p-5" style={{ borderColor: palette.border }}>
              <div className="flex items-start gap-3 mb-4">
                <p className="font-semibold text-ink leading-snug">{q.question_text}</p>
              </div>

              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => {
                    const selected = (answers[q.id] || [])[0] === opt.id
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selected ? 'border-primary bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
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
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selected ? 'border-primary bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        style={selected ? { borderColor: palette.base, backgroundColor: palette.soft } : undefined}
                      >
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-md border-2 shrink-0 transition-colors ${
                            selected ? '' : 'border-gray-300 bg-white'
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
          <Button onClick={handleSubmitAll} disabled={submitting} loading={submitting} className="w-full" size="lg" style={{ background: palette.cta, color: palette.onBase }}>
            Submit
          </Button>
        </div>
      </footer>
    </div>
  )
}
