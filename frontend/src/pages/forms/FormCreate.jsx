import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { stripTags } from '../../lib/sanitize'
import { Button, Input, Toggle, Select, Card, PageHeader, RichTextEditor } from '../../components/ui'

export default function FormCreate() {
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'form',
    require_login: false,
    submission_limit: 'unlimited',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripTags(form.title)) { setError('Title is required'); return }
    if (form.title.length > 1000) { setError('Title max 1000 characters'); return }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/forms', form)
      toast.success('Form created')
      navigate(`/forms/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to create form')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={() => navigate('/forms')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to forms
      </button>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <PageHeader
            eyebrow="New form"
            title="Create a new form"
            description="Start with the basics — you can add questions next."
          />

          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            <Card className="space-y-5">
              <div>
                <span className="field-label">Title</span>
                <RichTextEditor
                  value={form.title || ''}
                  onChange={(html) => { setForm((prev) => ({ ...prev, title: html })); setError('') }}
                  placeholder="e.g. Weekly Pop Quiz"
                  minHeight={60}
                />
                {error && <p className="field-error mt-1">{error}</p>}
              </div>

              <div>
                <span className="field-label">Description</span>
                <RichTextEditor
                  value={form.description || ''}
                  onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
                  placeholder="What is this form about?"
                  minHeight={120}
                />
              </div>

              <div>
                <span className="field-label">Type</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'form', label: 'Form', desc: 'Collect responses' },
                    { value: 'quiz', label: 'Quiz', desc: 'Auto-grade answers' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, type: t.value }))}
                      className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                        form.type === t.value
                          ? 'border-primary bg-primary-50 shadow-chip'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${form.type === t.value ? 'text-primary-700' : 'text-ink dark:text-gray-100'}`}>
                        {t.label}
                      </span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="divide-y divide-gray-100 dark:divide-gray-800">
              <SettingRow
                title="Require login"
                desc="Respondents must sign in first."
                control={<Toggle label="Require login" checked={form.require_login} onChange={(v) => setForm((prev) => ({ ...prev, require_login: v }))} />}
              />
              <div className="py-4">
                <Select label="Submission limit" name="submission_limit" value={form.submission_limit} onChange={handleChange}>
                  <option value="unlimited">Unlimited</option>
                  <option value="once">Once per person</option>
                </Select>
              </div>
            </Card>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading} className="flex-1" size="lg">
                {loading ? 'Creating...' : 'Create Form'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/forms')} size="lg">
                Cancel
              </Button>
            </div>
          </form>
      </motion.div>
    </div>
  )
}

function SettingRow({ title, desc, control }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium text-ink dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
      </div>
      {control}
    </div>
  )
}
