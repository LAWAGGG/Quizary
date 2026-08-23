import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, ArrowLeft, Save, Trash2, ImageUp, Link2, ChevronDown, Info, Lock, Settings2, Download, QrCode, X } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Button, Input, Select, Toggle, Card, StatusBadge, ConfirmModal, PageHeader, FormSubNav, PageSkeleton, RichTextEditor } from '../../components/ui'

function ShareLink({ value }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  // Compact: link bisa diklik (buka halaman publik) + tombol copy dalam satu baris.
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-ink-800/50 px-3.5 h-11">
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        title="Buka halaman publik"
        className="flex-1 min-w-0 font-mono text-sm text-gray-600 dark:text-gray-300 truncate hover:text-primary dark:hover:text-primary-300 transition-colors"
      >
        {value}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-ink dark:hover:text-gray-100 shrink-0 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-correct" /> : <Copy className="w-4 h-4" />}
        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  )
}

function CollapsibleCard({ title, icon, defaultOpen = false, open, onToggle, children }) {
  const [internal, setInternal] = useState(defaultOpen)
  const isOpen = open !== undefined ? open : internal
  const toggle = () => (onToggle ? onToggle(!isOpen) : setInternal(!isOpen))
  return (
    <Card padding={false} className="overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-gray-50/70 dark:hover:bg-ink-800/40 transition-colors"
      >
        <span className="text-primary shrink-0">{icon}</span>
        <h2 className="font-display font-semibold text-ink dark:text-gray-100">{title}</h2>
        <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 ml-auto shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </Card>
  )
}

function SettingRow({ title, desc, control }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink dark:text-gray-100">{title}</p>
        {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
      </div>
      {control}
    </div>
  )
}

export default function FormEdit() {
  const { formId: id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef(null)
  const qrRef = useRef(null)
  const [form, setForm] = useState(null)
  const [base, setBase] = useState(null)
  const [timerMinutes, setTimerMinutes] = useState('')
  const [initialTimerMinutes, setInitialTimerMinutes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [errors, setErrors] = useState({})
  const titleRef = useRef(null)
  const timerRef = useRef(null)
  const [basicOpen, setBasicOpen] = useState(false)
  const [behaviorOpen, setBehaviorOpen] = useState(false)

  // Buka card + scroll ke input yang error supaya user langsung lihat apa yang kurang.
  const revealError = (setOpen, ref) => {
    setOpen(true)
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  useEffect(() => {
    api.get(`/forms/${id}`)
      .then((res) => {
        setForm(res.data)
        setBase(res.data)
        const minutes = res.data.timer_seconds ? String(Math.round(res.data.timer_seconds / 60)) : ''
        setTimerMinutes(minutes)
        setInitialTimerMinutes(minutes)
      })
      .catch(() => navigate('/forms'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name === 'type' && value === 'form') {
      // Ganti tipe form → quiz balik: setelan khusus quiz ikut di-reset agar user
      // tidak perlu bolak-balik ke mode quiz untuk menonaktifkannya.
      setForm((prev) => ({ ...prev, type: value, timer_seconds: null, show_leaderboard: false, is_restricted: false }))
      if (type !== 'checkbox') setTimerMinutes('')
    } else {
      setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  // Enforce the same setting chain as the backend in the UI, so the editor
  // never sends contradictory values: is_restricted ⇒ once ⇒ require_login.
  const toggleSetting = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'is_restricted' && value) {
        next.submission_limit = 'once'
        next.require_login = true
      }
      if (key === 'submission_limit' && value === 'once') {
        next.require_login = true
      }
      return next
    })
  }

  function toBackendDate(str) {
    if (!str) return null
    let d
    if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
      const [date, time] = str.split(' ')
      const [day, month, year] = date.split('-').map(Number)
      const [h, m] = (time || '0:0').split(':').map(Number)
      d = new Date(year, month - 1, day, h || 0, m || 0)
    } else {
      d = new Date(str)
    }
    if (isNaN(d.getTime())) return null
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  }

  function normalize() {
    return {
      title: form.title,
      description: form.description || null,
      type: form.type,
      display_style: form.display_style || 'card',
      status: form.status,
      require_login: form.require_login,
      submission_limit: form.submission_limit,
      theme_color: form.theme_color || null,
      thank_you_message: form.thank_you_message || null,
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      show_leaderboard: form.show_leaderboard,
      is_restricted: form.is_restricted,
      show_in_history: form.show_in_history !== false,
      reveal_score: form.reveal_score !== false,
      reveal_answers: form.reveal_answers !== false,
      starts_at: toBackendDate(form.starts_at),
      ends_at: toBackendDate(form.ends_at),
    }
  }

  function baseSnapshot() {
    return {
      title: base.title,
      description: base.description || null,
      type: base.type,
      display_style: base.display_style || 'card',
      status: base.status,
      require_login: base.require_login,
      submission_limit: base.submission_limit,
      theme_color: base.theme_color || null,
      thank_you_message: base.thank_you_message || null,
      shuffle_questions: base.shuffle_questions,
      shuffle_options: base.shuffle_options,
      show_leaderboard: base.show_leaderboard,
      is_restricted: base.is_restricted,
      show_in_history: base.show_in_history !== false,
      reveal_score: base.reveal_score !== false,
      reveal_answers: base.reveal_answers !== false,
      starts_at: base.starts_at,
      ends_at: base.ends_at,
    }
  }

  function toInputDate(str) {
    if (!str) return ''
    if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
      const [date, time] = str.split(' ')
      const [day, month, year] = date.split('-')
      return `${year}-${month}-${day}T${(time || '').slice(0, 5)}`
    }
    return str
  }

  const timerChanged = timerMinutes !== initialTimerMinutes
  const dirty = form && base
    ? (JSON.stringify(normalize()) !== JSON.stringify(baseSnapshot()) || timerChanged)
    : false

  const buildPayload = () => ({
    ...normalize(),
    timer_seconds: timerMinutes ? Number(timerMinutes) * 60 : null,
  })

  const applyFieldErrors = (err) => {
    const data = err.response?.data
    if (data?.errors) {
      const mapped = {}
      data.errors.forEach((entry) => {
        Object.entries(entry).forEach(([k, v]) => { mapped[k] = v })
      })
      setErrors(mapped)
      if (mapped.title) revealError(setBasicOpen, titleRef)
      if (mapped.timer_seconds) revealError(setBehaviorOpen, timerRef)
      const unresolved = data.errors.filter((entry) => Object.keys(entry)[0] === '_schema')
      if (unresolved.length || data.message) {
        toast.error(data.message || 'Invalid fields')
      }
    } else {
      toast.error(data?.message || data?.detail || 'Failed to save changes')
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setErrors({ title: 'Title is required' })
      revealError(setBasicOpen, titleRef)
      return
    }
    // Quiz wajib punya timer (per menit) — dicek juga di backend saat publish.
    if (form.display_style === 'quiz' && !timerMinutes) {
      setErrors({ timer_seconds: 'Quiz harus memiliki waktu pengerjaan (menit)' })
      revealError(setBehaviorOpen, timerRef)
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/forms/${id}`, buildPayload())
      setForm(res.data)
      setBase(res.data)
      const minutes = res.data.timer_seconds ? String(Math.round(res.data.timer_seconds / 60)) : ''
      setTimerMinutes(minutes)
      setInitialTimerMinutes(minutes)
      setErrors({})
      toast.success('Changes saved successfully')
    } catch (err) {
      applyFieldErrors(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setForm(base)
    const minutes = base.timer_seconds ? String(Math.round(base.timer_seconds / 60)) : ''
    setTimerMinutes(minutes)
    setInitialTimerMinutes(minutes)
    setErrors({})
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/forms/${id}`)
      navigate('/forms')
    } catch {
      setDeleting(false); setShowDelete(false)
      toast.error('Failed to delete form')
    }
  }

  const downloadQr = () => {
    const canvas = qrRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${form.short_code}.png`
    a.click()
  }

  const handleBanner = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('banner', file)
    try {
      const res = await api.post(`/forms/${id}/banner`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const bannerPath = res.data.banner_path
      setForm((prev) => ({ ...prev, banner_path: bannerPath }))
      setBase((prev) => ({ ...prev, banner_path: bannerPath }))
      toast.success('Banner uploaded successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to upload banner')
    }
  }

  const handleRemoveBanner = async () => {
    try {
      await api.delete(`/forms/${id}/banner`)
      setForm((prev) => ({ ...prev, banner_path: null }))
      setBase((prev) => ({ ...prev, banner_path: null }))
      toast.success('Banner removed')
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to remove banner')
    }
  }

  if (loading) return <PageSkeleton />
  if (!form) return null

  const isRestricted = !!form.is_restricted
  const onceLocked = form.submission_limit === 'once'
  const isQuiz = form.display_style === 'quiz'

  return (
    <div>
      <button
        onClick={() => navigate('/forms')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to forms
      </button>

      <PageHeader
        eyebrow="Form workspace"
        title={form.title || 'Form Settings'}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={form.status} />
            <span className="text-gray-400 dark:text-gray-500">· {(form.display_style || 'card') === 'quiz' ? 'Quiz' : 'Form'} style</span>
          </span>
        }
      />

      <FormSubNav formId={id} className="mt-5" />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <CollapsibleCard title="Share" icon={<Link2 className="w-4 h-4" />} defaultOpen>
            <ShareLink value={`${window.location.origin}/q/${form.short_code}`} />
            <div className="mt-4">
              <Button
                variant="secondary"
                className="w-full"
                icon={<QrCode className="w-4 h-4" />}
                onClick={() => setShowQr(true)}
              >
                Show QR Code
              </Button>
            </div>
            <div className="mt-3">
              <Button onClick={() => setShowDelete(true)} variant="ghost-danger" className="w-full" icon={<Trash2 className="w-4 h-4" />}>
                Delete
              </Button>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Basic Information" icon={<Info className="w-4 h-4" />} open={basicOpen} onToggle={setBasicOpen}>
            <div className="space-y-5">
              <Input
                label="Title"
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={150}
                error={errors.title}
                ref={titleRef}
              />
              <div>
                <span className="field-label">Description</span>
                <RichTextEditor
                  value={form.description || ''}
                  onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
                  placeholder="Describe this form or quiz"
                  minHeight={120}
                />
                {errors.description && <p className="field-error">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select label="Type" name="type" value={form.type} onChange={handleChange} error={errors.type}>
                  <option value="form">Form</option>
                  <option value="quiz">Quiz</option>
                </Select>
                <div>
                  <label className="field-label !mb-1.5">Public status</label>
                  <div className="flex h-11 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, status: 'published' }))}
                      className={`flex-1 text-sm font-semibold transition-colors ${
                        form.status === 'published' ? 'bg-correct text-white' : 'bg-white dark:bg-ink-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, status: 'draft' }))}
                      className={`flex-1 text-sm font-semibold transition-colors ${
                        form.status !== 'published' && form.status !== 'closed' ? 'bg-gray-700 text-white' : 'bg-white dark:bg-ink-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, status: 'closed' }))}
                      className={`flex-1 text-sm font-semibold transition-colors ${
                        form.status === 'closed' ? 'bg-incorrect text-white' : 'bg-white dark:bg-ink-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                  {errors.status && (
                    <p className="field-error">{errors.status}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="field-label">Display Style</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, display_style: 'card' }))}
                    className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                      (form.display_style || 'card') === 'card'
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img src="/preview-form.png" alt="Card style" className="w-full h-32 object-cover" />
                    <span className="block text-sm font-medium py-2 text-ink dark:text-gray-100">Card</span>
                    {(form.display_style || 'card') === 'card' && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, display_style: 'quiz' }))}
                    className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                      form.display_style === 'quiz'
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img src="/preview-quiz.png" alt="Quiz style" className="w-full h-32 object-cover" />
                    <span className="block text-sm font-medium py-2 text-ink dark:text-gray-100">Quiz</span>
                    {form.display_style === 'quiz' && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                </div>
                {errors.display_style && <p className="field-error">{errors.display_style}</p>}
              </div>

              <Select
                label="Submission limit"
                name="submission_limit"
                value={isRestricted ? 'once' : form.submission_limit}
                onChange={(e) => { handleChange(e); toggleSetting('submission_limit', e.target.value) }}
                disabled={isRestricted}
                error={errors.submission_limit}
                helper={isRestricted ? 'Locked to Once while fullscreen mode is on.' : undefined}
              >
                <option value="unlimited">Unlimited</option>
                <option value="once">Once per person</option>
              </Select>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Access" icon={<Lock className="w-4 h-4" />}>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <SettingRow
                title="Require login"
                desc={onceLocked ? 'Automatically required because submission is limited to once.' : 'Respondents must sign in first.'}
                control={
                  <Toggle
                    label="Require login"
                    checked={form.require_login}
                    disabled={onceLocked}
                    onChange={(v) => toggleSetting('require_login', v)}
                  />
                }
              />
              <SettingRow
                title="Show in submission history"
                desc={form.show_in_history === false ? 'Hidden from respondents\u2019 My Submissions page.' : 'Appears in respondents\u2019 My Submissions page.'}
                control={
                  <Toggle
                    label="Show in history"
                    checked={form.show_in_history !== false}
                    onChange={(v) => setForm((prev) => ({ ...prev, show_in_history: v }))}
                  />
                }
              />
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Behavior" icon={<Settings2 className="w-4 h-4" />} open={behaviorOpen} onToggle={setBehaviorOpen}>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <SettingRow
                title="Shuffle questions"
                desc="Randomize the order for each respondent. Questions in a story group always stay together as one block."
                control={<Toggle label="Shuffle questions" checked={form.shuffle_questions} onChange={(v) => setForm((prev) => ({ ...prev, shuffle_questions: v }))} />}
              />
              <SettingRow
                title="Shuffle options"
                desc="Randomize answer order for each respondent."
                control={<Toggle label="Shuffle options" checked={form.shuffle_options} onChange={(v) => setForm((prev) => ({ ...prev, shuffle_options: v }))} />}
              />
              {isQuiz && (
                <>
                  <SettingRow
                    title="Show leaderboard"
                    desc="Show a read-only ranking to respondents after they submit."
                    control={<Toggle label="Show leaderboard" checked={!!form.show_leaderboard} onChange={(v) => toggleSetting('show_leaderboard', v)} />}
                  />
                  <SettingRow
                    title="Show final score"
                    desc="If off, respondents finish the quiz without seeing their score."
                    control={<Toggle label="Show final score" checked={form.reveal_score !== false} onChange={(v) => setForm((prev) => ({ ...prev, reveal_score: v }))} />}
                  />
                  <SettingRow
                    title="Show answer review"
                    desc="If off, respondents can't view which answers were correct/wrong."
                    control={<Toggle label="Show answer review" checked={form.reveal_answers !== false} onChange={(v) => setForm((prev) => ({ ...prev, reveal_answers: v }))} />}
                  />
                  <SettingRow
                    title="Restrict mode"
                    desc="Respondents must stay on the quiz tab. 3 exits marked as cheating"
                    control={<Toggle label="Restrict mode" checked={isRestricted} onChange={(v) => toggleSetting('is_restricted', v)} />}
                  />
                </>
              )}
              <div className="py-4">
                <Input
                  label={isQuiz ? 'Time limit (minutes) *' : 'Time limit (minutes)'}
                  type="number"
                  value={timerMinutes}
                  onChange={(e) => { setTimerMinutes(e.target.value); setErrors((p) => ({ ...p, timer_seconds: undefined })) }}
                  placeholder="e.g. 10"
                  min={1}
                  max={1440}
                  helper={isQuiz ? 'Wajib untuk quiz. Pengerjaan otomatis dikumpulkan saat waktu habis.' : 'Leave empty for no time limit.'}
                  error={errors.timer_seconds}
                  ref={timerRef}
                />
              </div>
              <div className="py-4">
                <div>
                  <label className="field-label">Theme color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      name="theme_color"
                      value={form.theme_color || '#6C5CE7'}
                      onChange={handleChange}
                      className={`w-11 h-11 rounded-xl cursor-pointer border border-gray-200 dark:border-gray-700 shrink-0 ${errors.theme_color ? 'border-incorrect' : ''}`}
                      aria-label="Theme color"
                    />
                    <input
                      name="theme_color"
                      value={form.theme_color || ''}
                      onChange={handleChange}
                      className={`input-field font-mono ${errors.theme_color ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''}`}
                      placeholder="#6C5CE7"
                    />
                  </div>
                  {errors.theme_color && <p className="field-error">{errors.theme_color}</p>}
                </div>
              </div>
              <div className="py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Opens at</label>
                    <input
                      type="datetime-local"
                      name="starts_at"
                      value={toInputDate(form.starts_at)}
                      onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))}
                      className={`input-field ${errors.starts_at ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''}`}
                    />
                    {errors.starts_at && <p className="field-error">{errors.starts_at}</p>}
                  </div>
                  <div>
                    <label className="field-label">Closes at</label>
                    <input
                      type="datetime-local"
                      name="ends_at"
                      value={toInputDate(form.ends_at)}
                      onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))}
                      className={`input-field ${errors.ends_at ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''}`}
                    />
                    {errors.ends_at && <p className="field-error">{errors.ends_at}</p>}
                  </div>
                </div>
              </div>
              <div className="py-4">
                <div>
                  <span className="field-label">Thank you message</span>
                  <RichTextEditor
                    value={form.thank_you_message || ''}
                    onChange={(html) => setForm((prev) => ({ ...prev, thank_you_message: html }))}
                    placeholder="Thank you for filling out this form"
                    minHeight={90}
                  />
                  {errors.thank_you_message && <p className="field-error">{errors.thank_you_message}</p>}
                </div>
              </div>
            </div>
          </CollapsibleCard>
        </div>

        <div className="space-y-6">
          <CollapsibleCard title="Banner" icon={<ImageUp className="w-4 h-4" />}>
            {form.banner_path ? (
              <img src={form.banner_path} alt="Banner" className="w-full h-36 object-cover rounded-xl mb-4" />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-36 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:text-primary"
              >
                <ImageUp className="w-6 h-6" />
                <span className="text-sm font-medium">Upload a banner</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleBanner} className="hidden" />
            {form.banner_path && (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()} icon={<ImageUp className="w-4 h-4" />}>
                  Change Banner
                </Button>
                <Button type="button" variant="ghost-danger" size="sm" className="flex-1" onClick={handleRemoveBanner} icon={<Trash2 className="w-4 h-4" />}>
                  Remove
                </Button>
              </div>
            )}
          </CollapsibleCard>
        </div>
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-4 inset-x-4 z-50 flex justify-center pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-ink-900 border border-gray-200 dark:border-gray-700 shadow-lift rounded-2xl px-4 py-3 w-full max-w-md">
              <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">Unsaved changes</p>
              <Button variant="ghost" size="sm" onClick={handleDiscard}>Discard</Button>
              <Button size="sm" onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        show={showDelete}
        title="Delete Form?"
        message="All data including questions and answers will be permanently deleted."
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        loading={deleting}
        confirmText="Delete"
        variant="danger"
      />

      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
            onClick={() => setShowQr(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="bg-white dark:bg-ink-900 rounded-2xl p-6 w-full max-w-sm shadow-lift relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQr(false)}
                className="absolute top-3 right-3 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                aria-label="Close QR code"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100 mb-1">Scan to open</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Pindai kode QR untuk membuka {form.title}.</p>
              <div className="flex justify-center p-4 border border-gray-100 dark:border-gray-800 rounded-2xl">
                <QRCodeCanvas
                  ref={qrRef}
                  value={`${window.location.origin}/q/${form.short_code}`}
                  size={220}
                  marginSize={2}
                  level="M"
                  className="rounded-lg"
                />
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="w-full mt-5"
                onClick={downloadQr}
                icon={<Download className="w-4 h-4" />}
              >
                Download QR
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
