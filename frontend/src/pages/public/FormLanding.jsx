import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Clock, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react'
import { Button, Input, Card, AppMark, FallbackPage, DotCorner, SpotlightCard, AuroraBg, RichText } from '../../components/ui'
import { useTheme } from '../../hooks/useTheme'
import { themePalette } from '../../lib/theme'
import api from '../../api/client'
import { saveSessionToken } from '../../lib/sessionToken'

const BUBBLES = Array.from({ length: 12 }, (_, i) => i)

function BlockedState({ background, icon, title, children }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6" style={{ background }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center text-white max-w-md"
      >
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mb-6">
          {icon}
        </span>
        <p className="font-display text-xl font-semibold">{title}</p>
        {children}
      </motion.div>
    </div>
  )
}

export default function FormLanding() {
  const { shortCode } = useParams()
  const navigate = useNavigate()
  const { theme } = useTheme()

  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startState, setStartState] = useState(null)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get(`/q/${shortCode}`)
      .then((res) => setForm(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Form not found'))
      .finally(() => setLoading(false))
  }, [shortCode])

  const handleStart = async () => {
    try {
      const res = await api.get(`/q/${shortCode}/start`)
      const data = res.data
      if (data.can_start && !data.require_identity) {
        const sub = await api.post('/submissions', { form_id: data.form_id })
        saveSessionToken(sub.data.submission_id, sub.data.access_token)
        navigate(`/s/${sub.data.submission_id}?type=${form.type}&style=${form.display_style || 'card'}&title=${encodeURIComponent(form.title)}&code=${shortCode}`)
      } else {
        setStartState(data)
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setStartState({ requires_login: true })
      } else if (err.response?.status === 410) {
        setStartState({ session_expired: true })
      } else {
        setError(err.response?.data?.message || err.response?.data?.detail || 'Something went wrong')
      }
    }
  }

  const handleSubmitIdentity = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post('/submissions', {
        form_id: startState.form_id,
        respondent_name: name,
        respondent_email: email || undefined,
      })
      saveSessionToken(res.data.submission_id, res.data.access_token)
      navigate(`/s/${res.data.submission_id}?type=${form.type}&style=${form.display_style || 'card'}&title=${encodeURIComponent(form.title)}&code=${shortCode}`)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to start')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper dark:bg-ink-950">
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
        title="404"
        message={error}
        action={<Button onClick={() => navigate('/')} className="w-full">Go home</Button>}
      />
    )
  }

  if (!form) return null

  const displayStyle = form.display_style || 'card'
  const palette = themePalette(form.theme_color, theme === 'dark')
  const isOwner = form.is_owner === true
  const isPreview = isOwner && form.status !== 'published'

  // Status dicek di landing; jadwal (starts_at/ends_at) tidak diekspos ke
  // responden — penegakan jadwal tetap di server via GET /start.
  let blocked = null
  if (!isPreview) {
    if (form.status === 'closed') {
      blocked = { title: 'Form is closed', desc: 'The response period for this form has ended.' }
    } else if (form.status === 'draft') {
      blocked = { title: 'This form is not published yet.', desc: 'The creator hasn\u2019t published this form. Check back later.' }
    }
  }

  if (blocked) {
    return (
      <BlockedState
        background={palette.gradient}
        icon={blocked.title === 'Form is not opened' ? <Clock className="w-6 h-6 text-white" /> : <Lock className="w-6 h-6 text-white" />}
        title={blocked.title}
      >
        <p className="text-white/70 text-sm mt-2 mb-6">{blocked.desc}</p>
      </BlockedState>
    )
  }

  if (startState) {
    if (startState.session_expired) {
      return (
        <BlockedState
          background={palette.gradient}
          icon={<Clock className="w-6 h-6 text-white" />}
          title="Your previous session ended"
        >
          <p className="text-white/70 text-sm mt-2 mb-6">
            Waktu pengerjaan sebelumnya habis dan jawabanmu sudah otomatis terkirim. Kamu bisa mulai sesi baru jika masih tersedia.
          </p>
          <Button variant="secondary" size="xl" onClick={handleStart}>
            Start New Session
          </Button>
        </BlockedState>
      )
    }

    if (startState.requires_login) {
      return (
        <BlockedState
          background={palette.gradient}
          icon={<Lock className="w-6 h-6 text-white" />}
          title="Sign in required"
        >
          <p className="text-white/70 text-sm mt-2 mb-6">You need to sign in to access {form.title}.</p>
          <Button variant="secondary" size="xl" onClick={() => navigate('/login')}>
            Login
          </Button>
        </BlockedState>
      )
    }

    if (!startState.can_start) {
      const msgs = {
        not_started: 'Form is not opened',
        closed: 'Form is closed',
        draft: 'This form is not published yet.',
        already_submitted: 'You have already submitted this form.',
      }
      const icons = {
        not_started: <Clock className="w-6 h-6 text-white" />,
        closed: <Lock className="w-6 h-6 text-white" />,
        draft: <Lock className="w-6 h-6 text-white" />,
        already_submitted: <CheckCircle2 className="w-6 h-6 text-white" />,
      }
      return (
        <BlockedState
          background={palette.gradient}
          icon={icons[startState.reason] || <Lock className="w-6 h-6 text-white" />}
          title={msgs[startState.reason] || 'Access denied'}
        >
          <p className="text-white/70 text-sm mt-2 mb-6">
            {startState.reason === 'not_started' && 'This form hasn\u2019t opened yet. Please check back later.'}
            {startState.reason === 'closed' && 'The response period for this form has ended.'}
            {startState.reason === 'draft' && 'The creator hasn\u2019t published this form. Check back later.'}
            {startState.reason === 'already_submitted' && 'You can only submit this form once.'}
          </p>
        </BlockedState>
      )
    }

    return (
      <div className="theme-surface min-h-dvh relative overflow-hidden flex items-center justify-center p-6 bg-paper dark:bg-ink-950" style={{ '--t': palette.base }}>
        <DotCorner position="top-left" color={palette.base} />
        <DotCorner position="bottom-right" color={palette.base} />
        {isPreview && <PreviewNotice />}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-2.5 mb-6 justify-center">
            <AppMark size="sm" />
            <span className="font-display font-bold text-ink dark:text-gray-100">Quizary</span>
          </div>
          <Card className="p-6 md:p-7" style={{ borderColor: palette.border }}>
            <h2 className="font-display text-xl font-bold text-ink dark:text-gray-100">{form.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Enter your details to begin</p>
            <form onSubmit={handleSubmitIdentity} className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
              <Input
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
              <Button type="submit" disabled={submitting || !name.trim()} loading={submitting} className="w-full" size="lg" style={{ background: palette.cta, color: palette.onBase }}>
                Start
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (displayStyle === 'quiz') {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: palette.gradient, '--color-primary': palette.base }}>
        {isPreview && <PreviewNotice />}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: palette.blobLight }} aria-hidden="true" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: palette.blobDark }} aria-hidden="true" />

          <div className="flex items-center gap-2.5 mb-10">
            <img src="/Quizary_Logo_White.png" alt="Quizary" className="w-8 h-8" />
            <span className="font-display font-bold text-white text-2xl">Quizary</span>
          </div>

          {form.banner_path && (
            <motion.img
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              src={form.banner_path}
              alt=""
              className="w-full max-w-3xl h-52 md:h-64 object-cover rounded-2xl mb-10 shadow-lift border-4 border-white/20"
            />
          )}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl md:text-5xl font-bold leading-tight text-white max-w-2xl"
          >
            {form.title}
          </motion.h1>
          {form.description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-lg opacity-80 max-w-lg text-white mt-4"
          >
            <RichText html={form.description} className="rich-text" />
          </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 flex items-center gap-3"
          >
            <InfoChip icon={<HelpCircle className="w-3.5 h-3.5" />} text={`${form.question_count ?? 0} question${(form.question_count ?? 0) !== 1 ? 's' : ''}`} />
            {form.timer_seconds > 0 && (
              <InfoChip icon={<Clock className="w-3.5 h-3.5" />} text={`${Math.ceil(form.timer_seconds / 60)} min`} />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10"
          >
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 h-14 px-10 rounded-full bg-white text-base font-bold text-[var(--color-primary)] hover:scale-[1.03] active:scale-95 transition-transform shadow-lift"
            >
              Start
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>

        <div className="pb-6 flex items-center gap-3 justify-center">
          {BUBBLES.map((i) => (
            <span
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-colors ${
                i === 2 || i === 5 || i === 8 ? 'border-white bg-white' : 'border-white/25'
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="theme-surface min-h-dvh relative overflow-hidden flex flex-col" style={{ background: palette.pageBg, '--t': palette.base }}>
      <AuroraBg base={palette.base} className="opacity-25" />
      <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" aria-hidden="true" />
      <DotCorner position="top-left" color={palette.base} />
      <DotCorner position="bottom-right" color={palette.base} />
      {isPreview && <PreviewNotice />}
      <div className="flex-1 max-w-lg mx-auto w-full p-6 relative">
        {form.banner_path && (
          <img src={form.banner_path} alt="" className="w-full h-40 object-cover rounded-3xl mb-6 shadow-card" />
        )}
        <SpotlightCard>
          <Card className="p-6 md:p-7 h-full" style={{ borderColor: palette.border }}>
            <h1 className="font-display text-2xl font-bold text-ink dark:text-gray-100 mb-2">{form.title}</h1>
            {form.description && <p className="text-gray-600 dark:text-gray-400 mb-6"><RichText html={form.description} className="rich-text" /></p>}
            <Button onClick={handleStart} className="w-full" size="lg" style={{ background: palette.cta, color: palette.onBase }} icon={<ArrowRight className="w-4 h-4" />}>
              Start
            </Button>
          </Card>
        </SpotlightCard>
        <div className="flex items-center justify-center gap-3 mt-6">
          <InfoChip icon={<HelpCircle className="w-3.5 h-3.5" />} text={`${form.question_count ?? 0} question${(form.question_count ?? 0) !== 1 ? 's' : ''}`} />
          {form.timer_seconds > 0 && (
            <InfoChip icon={<Clock className="w-3.5 h-3.5" />} text={`${Math.ceil(form.timer_seconds / 60)} min`} />
          )}
        </div>
      </div>
    </div>
  )
}

function InfoChip({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-ink-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full shadow-chip">
      {icon}
      {text}
    </span>
  )
}

function PreviewNotice() {
  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-[calc(100%-32px)]">
      <div className="inline-flex items-center gap-2 bg-ink text-white px-3.5 py-2 rounded-full shadow-lift text-xs">
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Preview mode</span> — belum dipublikasikan
        </span>
      </div>
    </div>
  )
}
