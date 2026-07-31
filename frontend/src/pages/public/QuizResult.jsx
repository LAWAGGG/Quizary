import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Minus, Eye, EyeOff, ArrowRight, ClipboardList } from 'lucide-react'
import { Button, Card, Badge } from '../../components/ui'
import api from '../../api/client'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatSubmitted(str) {
  if (!str) return '—'
  const [d, m, Y, H, M] = str.split(/[\s:-]+/).map(Number)
  if (!d || !m || !Y) return str
  return `${d} ${MONTHS[m - 1]} ${Y}, ${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`
}

export default function QuizResult() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(window.location.search)
  const formType = searchParams.get('type') || 'form'
  const formTitle = searchParams.get('title') || ''
  const formCode = searchParams.get('code') || ''

  const [data, setData] = useState(null)
  const [publicForm, setPublicForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [countedScore, setCountedScore] = useState(0)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    const sub = api.get(`/submissions/${submissionId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load results'))
    const pub = formCode
      ? api.get(`/q/${formCode}`).then((res) => setPublicForm(res.data)).catch(() => setPublicForm(null))
      : Promise.resolve()
    Promise.all([sub, pub]).finally(() => setLoading(false))
  }, [submissionId, formCode])

  useEffect(() => {
    if (!data || data.score == null) return
    const target = Math.round(data.score)
    const duration = 1000
    const start = performance.now()

    let frame
    function animate(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      setCountedScore(Math.round(progress * target))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [data])

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
      <div className="min-h-dvh flex items-center justify-center bg-ink p-6">
        <div className="text-center">
          <p className="text-white/30 text-5xl font-display font-bold mb-2">!</p>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const isQuiz = formType === 'quiz'
  const canRefill = publicForm?.submission_limit === 'unlimited' && formCode
  const themeColor = publicForm?.theme_color || '#6C5CE7'
  const totalQ = data.answers?.length || 0

  if (!isQuiz) {
    const thankYou = publicForm?.thank_you_message || 'Thank you for your response!'

    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <Card className="p-6 md:p-8 overflow-hidden relative">
            <div
              className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-10 pointer-events-none"
              style={{ backgroundColor: themeColor }}
              aria-hidden="true"
            />

            <div className="text-center mb-6">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full text-white shadow-lift"
                style={{ backgroundColor: themeColor }}
              >
                <Check className="w-8 h-8" strokeWidth={3} />
              </motion.span>
              <p className="eyebrow mt-5">Submitted</p>
              <h1 className="font-display text-2xl md:text-[26px] font-bold text-ink mt-2 leading-snug">
                {thankYou}
              </h1>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {formTitle ? (
                  <>Your response to <span className="font-semibold text-ink">"{formTitle}"</span> has been recorded.</>
                ) : (
                  'Your response has been recorded.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <MetaChip label="Questions" value={String(totalQ)} />
              <MetaChip label="Submitted" value={formatSubmitted(data.submitted_at)} />
              <MetaChip label="Reference" value={`#${submissionId}`} />
            </div>

            <div className="border-t border-gray-100 pt-5">
              {canRefill ? (
                <Button
                  onClick={() => navigate(`/q/${formCode}`)}
                  size="lg"
                  className="w-full"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Fill Again
                </Button>
              ) : (
                <p className="text-center text-sm text-gray-400">
                  You can close this page.
                </p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  const correctCount = data.answers?.filter((a) => a.is_correct === true).length || 0
  const wrongCount = data.answers?.filter((a) => a.is_correct === false).length || 0
  const unansweredCount = data.answers?.filter((a) => a.is_correct === null).length || 0
  const percentage = data.max_score > 0 ? Math.round((data.score / data.max_score) * 100) : 0

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  }

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  }

  const statusIcon = (isCorrect) => {
    if (isCorrect === true) return <span className="w-7 h-7 rounded-full bg-correct-soft text-correct flex items-center justify-center shrink-0"><Check className="w-4 h-4" strokeWidth={3} /></span>
    if (isCorrect === false) return <span className="w-7 h-7 rounded-full bg-incorrect-soft text-incorrect flex items-center justify-center shrink-0"><X className="w-4 h-4" strokeWidth={3} /></span>
    return <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"><Minus className="w-4 h-4" strokeWidth={3} /></span>
  }

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-lg mx-auto p-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {formTitle && (
            <p className="eyebrow justify-center">{formTitle}</p>
          )}

          <div className="relative w-36 h-36 mx-auto mt-5 mb-5">
            <svg className="w-full h-full" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-200" />
              <motion.circle
                cx="64" cy="64" r="56"
                fill="none"
                stroke="currentColor"
                className={percentage >= 70 ? 'text-correct' : percentage >= 40 ? 'text-warn' : 'text-incorrect'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 3.52} 352`}
                transform="rotate(-90 64 64)"
                initial={{ strokeDasharray: '0 352' }}
                animate={{ strokeDasharray: `${percentage * 3.52} 352` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="font-display text-3xl font-bold text-ink tabular-nums"
                >
                  {countedScore}
                </motion.span>
                {data.max_score > 0 && (
                  <span className="text-sm text-gray-400">/{Math.round(data.max_score)}</span>
                )}
              </div>
            </div>
          </div>

          {data.max_score > 0 && (
            <p className="font-display text-xl font-semibold text-ink tabular-nums">{percentage}%</p>
          )}

          {totalQ > 0 && (
            <div className="flex justify-center gap-3 mt-5">
              <span className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-correct-soft text-correct text-sm font-semibold">
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> {correctCount}
              </span>
              <span className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-incorrect-soft text-incorrect text-sm font-semibold">
                <X className="w-3.5 h-3.5" strokeWidth={3} /> {wrongCount}
              </span>
              {unansweredCount > 0 && (
                <span className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">
                  <Minus className="w-3.5 h-3.5" strokeWidth={3} /> {unansweredCount}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {totalQ > 0 && (
          <>
            <Button
              variant="secondary"
              onClick={() => setShowReview(!showReview)}
              className="w-full mb-4"
              icon={showReview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            >
              {showReview ? 'Hide Review' : 'View Answer Review'}
            </Button>

            <AnimatePresence>
              {showReview && (
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {data.answers.map((answer, i) => (
                    <motion.div key={answer.question_id} variants={item}>
                      <Card className="p-5">
                        <div className="flex items-start gap-3">
                          {statusIcon(answer.is_correct)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 mb-1">Question {i + 1}</p>
                            <p className="font-medium text-ink mb-2 leading-snug">{answer.question_text}</p>

                            <p className="text-xs text-gray-400">Your answer</p>
                            <p className="text-sm font-medium text-ink mb-3">
                              {(answer.question_type === 'multiple_choice' || answer.question_type === 'checkbox')
                                ? (answer.selected_options?.length > 0
                                    ? answer.selected_options.join(', ')
                                    : <span className="text-gray-400 italic">(not answered)</span>)
                                : (answer.answer_text || <span className="text-gray-400 italic">(not answered)</span>)}
                            </p>

                            <div className="flex items-center gap-2">
                              {answer.is_correct === true && <Badge scheme="green">Correct</Badge>}
                              {answer.is_correct === false && <Badge scheme="red">Incorrect</Badge>}
                              {answer.is_correct === null && <Badge scheme="gray">Not graded</Badge>}
                              {answer.points_earned != null && answer.points_earned > 0 && (
                                <span className="text-xs text-gray-400 tabular-nums">+{answer.points_earned} pts</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {canRefill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <Button
              onClick={() => navigate(`/q/${formCode}`)}
              size="lg"
              className="w-full"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Fill Again
            </Button>
          </motion.div>
        )}

        {!canRefill && (
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <ClipboardList className="w-3.5 h-3.5" />
            You can close this page.
          </div>
        )}
      </div>
    </div>
  )
}

function MetaChip({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 px-2 py-3 text-center min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-ink mt-1 truncate max-w-full">{value}</span>
    </div>
  )
}
