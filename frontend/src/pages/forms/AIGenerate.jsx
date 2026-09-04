import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, RefreshCw, Check, X, FileText, Clock, Shuffle, Lock, ListChecks } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { stripTags } from '../../lib/sanitize'
import { Button, Card, PageHeader, RichTextEditor, RichText, Textarea, Badge } from '../../components/ui'

const humanizeType = (t) => (t || '').replace(/_/g, ' ')

const ACCEPT_EXT = '.docx,.pdf,.pptx'
const MAX_FILES = 5

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

export default function AIGenerate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef(null)

  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formType, setFormType] = useState('form')
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState([])
  const [quota, setQuota] = useState(null)
  const [draft, setDraft] = useState(null)
  const [modelUsed, setModelUsed] = useState('')
  const [generating, setGenerating] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/ai/quota').then((r) => setQuota(r.data)).catch(() => {})
  }, [])

  const questionCount = draft ? draft.sections.reduce((n, s) => n + s.questions.length, 0) : 0

  const pickFiles = (e) => {
    const chosen = Array.from(e.target.files || []).slice(0, MAX_FILES - files.length)
    if (chosen.length) setFiles((prev) => [...prev, ...chosen].slice(0, MAX_FILES))
    e.target.value = ''
  }

  const handleGenerate = async (e) => {
    e?.preventDefault()
    if (!stripTags(title)) { setError(t('aiGenerate.titleRequired')); return }
    if (prompt.trim().length < 10) { setError(t('aiGenerate.promptMin')); return }
    setGenerating(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('description', description || '')
      fd.append('type', formType)
      fd.append('prompt', prompt)
      files.forEach((f) => fd.append('files', f))
      const res = await api.post('/ai/generate', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      })
      setDraft(res.data.draft)
      setModelUsed(res.data.model || '')
      setQuota((q) => (q ? { ...q, remaining: res.data.remaining, used: q.limit - res.data.remaining } : q))
      setStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const msg = err.response?.data?.message || err.code === 'ECONNABORTED' ? t('aiGenerate.timeout') : t('aiGenerate.generateFailed')
      setError(typeof msg === 'string' ? msg : t('aiGenerate.generateFailed'))
      toast.error(err.response?.data?.message || t('aiGenerate.generateFailed'))
    } finally {
      setGenerating(false)
    }
  }

  const handleAccept = async () => {
    if (!stripTags(title)) { setError(t('aiGenerate.titleRequired')); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setAccepting(true)
    setError('')
    try {
      const res = await api.post('/ai/accept', {
        title,
        description: description || null,
        type: formType,
        settings: draft.settings,
        sections: draft.sections,
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

  const quotaEmpty = quota && quota.remaining <= 0

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={() => navigate('/forms')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> {t('aiGenerate.back')}
      </button>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <PageHeader
          eyebrow={t('aiGenerate.eyebrow')}
          title={t('aiGenerate.title')}
          description={t('aiGenerate.description')}
        />
        <div className="mt-3"><QuotaPill quota={quota} /></div>

        {step === 1 ? (
          <form onSubmit={handleGenerate} className="space-y-5 mt-6">
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
                      className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${formType === o.value ? 'border-primary bg-primary-50 shadow-chip' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 hover:border-gray-300 dark:hover:border-gray-600'}`}
                    >
                      <span className={`block text-sm font-semibold ${formType === o.value ? 'text-primary-700' : 'text-ink dark:text-gray-100'}`}>{o.label}</span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <Textarea
                label={t('aiGenerate.promptLabel')}
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setError('') }}
                placeholder={t('aiGenerate.promptPlaceholder')}
                helper={t('aiGenerate.promptHint')}
                rows={4}
              />
              <div>
                <span className="field-label">{t('aiGenerate.filesLabel')}</span>
                <input ref={fileRef} type="file" multiple accept={ACCEPT_EXT} onChange={pickFiles} className="hidden" />
                {files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 px-3.5 h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-ink-800/50">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="flex-1 min-w-0 text-sm text-ink dark:text-gray-100 truncate">{f.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-incorrect transition-colors" aria-label={t('aiGenerate.removeFile')}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {files.length < MAX_FILES && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    {t('aiGenerate.filesAdd')}
                  </Button>
                )}
                <p className="field-hint mt-1">{t('aiGenerate.filesHint')}</p>
              </div>
            </Card>

            {error && <p className="field-error">{error}</p>}
            {quotaEmpty && <p className="field-error">{t('aiGenerate.quotaEmpty')}</p>}

            <Button type="submit" loading={generating} disabled={quotaEmpty} className="w-full" size="lg" icon={<Sparkles className="w-4 h-4" />}>
              {generating ? t('aiGenerate.generating') : t('aiGenerate.generate')}
            </Button>
          </form>
        ) : (
          <div className="space-y-5 mt-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-ink dark:text-gray-100">
                  {t('aiGenerate.previewTitle', { count: questionCount })}
                </h2>
                {modelUsed && (
                  <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-ink-800 text-gray-500 dark:text-gray-400">
                    <Sparkles className="w-3 h-3" />{modelUsed}
                  </span>
                )}
              </div>
              <SettingChips settings={draft.settings} />
              <div>
                <span className="field-label">{t('aiGenerate.titleLabel')}</span>
                <RichTextEditor value={title} onChange={setTitle} minHeight={60} />
              </div>
              <div>
                <span className="field-label">{t('aiGenerate.descLabel')}</span>
                <RichTextEditor value={description} onChange={setDescription} minHeight={80} />
              </div>
            </Card>

            {draft.sections.map((sec, si) => (
              <Card key={si} className="space-y-3">
                <h3 className="font-display font-semibold text-ink dark:text-gray-100">{si + 1}. {sec.title}</h3>
                {sec.questions.map((q, qi) => (
                  <div key={qi} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge scheme="blue">{humanizeType(q.type)}</Badge>
                      {q.is_required && <span className="text-incorrect font-bold">*</span>}
                      {q.points > 0 && <span className="text-xs text-gray-400">{t('aiGenerate.points', { points: q.points })}</span>}
                    </div>
                    <div className="text-sm text-ink dark:text-gray-100"><RichText html={q.question_text} /></div>
                    {q.options?.length > 0 && (
                      <ul className="space-y-1">
                        {q.options.map((o, oi) => (
                          <li key={oi} className={`flex items-start gap-2 text-sm px-2.5 py-1.5 rounded-lg ${o.is_correct ? 'bg-correct-soft text-correct font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                            {o.is_correct ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <span className="w-4 h-4 shrink-0 mt-0.5 text-center leading-4 text-gray-300">·</span>}
                            <span>{o.option_text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </Card>
            ))}

            {error && <p className="field-error">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleAccept} loading={accepting} className="flex-1" size="lg" icon={<Check className="w-4 h-4" />}>
                {accepting ? t('aiGenerate.accepting') : t('aiGenerate.accept')}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => { setStep(1); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                icon={<RefreshCw className="w-4 h-4" />}
                title={t('aiGenerate.regenerateHint')}
              >
                {t('aiGenerate.regenerate')}
              </Button>
            </div>
            <p className="field-hint text-center">{t('aiGenerate.regenerateHint')}</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
