import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Check, ArrowLeft, Save, Send, Trash2, ImageUp, Link2 } from 'lucide-react'
import api from '../../api/client'
import { Button, Input, Textarea, Select, Toggle, Card, StatusBadge, ConfirmModal, PageHeader, FormSubNav, PageSkeleton } from '../../components/ui'

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <input
            readOnly
            value={value}
            onFocus={(e) => e.target.select()}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 font-mono truncate outline-none"
          />
        </div>
        <Button variant="secondary" size="md" onClick={handleCopy} icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

function SettingRow({ title, desc, control }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {control}
    </div>
  )
}

export default function FormEdit() {
  const { formId: id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get(`/forms/${id}`)
      .then((res) => setForm(res.data))
      .catch(() => navigate('/forms'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function toBackendDate(str) {
    if (!str) return null
    const d = new Date(str)
    if (isNaN(d.getTime())) return null
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError(''); setSuccess('')
    const payload = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      is_public: form.is_public,
      require_login: form.require_login,
      submission_limit: form.submission_limit,
      theme_color: form.theme_color || null,
      thank_you_message: form.thank_you_message || null,
      timer_seconds: form.timer_seconds ? Number(form.timer_seconds) : null,
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      status: form.status,
      starts_at: toBackendDate(form.starts_at),
      ends_at: toBackendDate(form.ends_at),
    }
    try {
      const res = await api.put(`/forms/${id}`, payload)
      setForm(res.data)
      setSuccess('Changes saved successfully')
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (status) => {
    setPublishing(true); setError('')
    try {
      await api.patch(`/forms/${id}/publish`, { status })
      setForm((prev) => ({ ...prev, status }))
      setSuccess(status === 'published' ? 'Form published successfully' : 'Form returned to draft')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status')
    } finally {
      setPublishing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/forms/${id}`)
      navigate('/forms')
    } catch {
      setDeleting(false); setShowDelete(false)
      setError('Failed to delete form')
    }
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
      setForm((prev) => ({ ...prev, banner_path: res.data.banner_path }))
      setSuccess('Banner uploaded successfully')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload banner')
    }
  }

  if (loading) return <PageSkeleton />
  if (!form) return null

  return (
    <div>
      <button
        onClick={() => navigate('/forms')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to forms
      </button>

      <PageHeader
        eyebrow="Form workspace"
        title={form.title || 'Form Settings'}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={form.status} />
            <span className="text-gray-400">· {form.type === 'quiz' ? 'Quiz' : 'Form'}</span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => navigate(`/forms/${id}/questions`)}>Questions</Button>
            <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <FormSubNav formId={id} className="mt-5" />

      {error && (
        <div className="bg-incorrect-soft border border-incorrect/20 text-incorrect px-4 py-3 rounded-xl mt-6 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-correct-soft border border-correct/20 text-correct px-4 py-3 rounded-xl mt-6 text-sm">{success}</div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Link2 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-ink">Share</h2>
            </div>
            <CopyField label="Public Link" value={`${window.location.origin}/q/${form.short_code}`} />
            <div className="flex gap-2 mt-4">
              {form.status !== 'published' ? (
                <Button onClick={() => handlePublish('published')} loading={publishing} variant="soft" icon={<Send className="w-4 h-4" />} className="flex-1">
                  {publishing ? 'Publishing...' : 'Publish'}
                </Button>
              ) : (
                <Button onClick={() => handlePublish('draft')} loading={publishing} variant="secondary" className="flex-1">
                  {publishing ? '...' : 'Unpublish'}
                </Button>
              )}
              <Button onClick={() => setShowDelete(true)} variant="ghost-danger" icon={<Trash2 className="w-4 h-4" />}>
                Delete
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-ink mb-5">Basic Information</h2>
            <div className="space-y-5">
              <Input label="Title" name="title" value={form.title} onChange={handleChange} maxLength={150} />
              <Textarea label="Description" name="description" value={form.description || ''} onChange={handleChange} rows={3} />

              <div className="grid grid-cols-2 gap-4">
                <Select label="Type" name="type" value={form.type} onChange={handleChange}>
                  <option value="form">Form</option>
                  <option value="quiz">Quiz</option>
                </Select>
                <Select label="Status" name="status" value={form.status} onChange={handleChange}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </Select>
              </div>

              <Select label="Submission limit" name="submission_limit" value={form.submission_limit} onChange={handleChange}>
                <option value="unlimited">Unlimited</option>
                <option value="once">Once per person</option>
              </Select>
            </div>
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-ink mb-3">Access</h2>
            <div className="divide-y divide-gray-100">
              <SettingRow
                title="Public form"
                desc="Anyone with the link can answer."
                control={<Toggle label="Public form" checked={form.is_public} onChange={(v) => setForm((prev) => ({ ...prev, is_public: v }))} />}
              />
              <SettingRow
                title="Require login"
                desc="Respondents must sign in first."
                control={<Toggle label="Require login" checked={form.require_login} onChange={(v) => setForm((prev) => ({ ...prev, require_login: v }))} />}
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-ink mb-3">Behavior</h2>
            <div className="divide-y divide-gray-100">
              <SettingRow
                title="Shuffle questions"
                desc="Randomize the order for each respondent."
                control={<Toggle label="Shuffle questions" checked={form.shuffle_questions} onChange={(v) => setForm((prev) => ({ ...prev, shuffle_questions: v }))} />}
              />
              <SettingRow
                title="Shuffle options"
                desc="Randomize answer order for each respondent."
                control={<Toggle label="Shuffle options" checked={form.shuffle_options} onChange={(v) => setForm((prev) => ({ ...prev, shuffle_options: v }))} />}
              />
              <div className="py-4">
                <Input
                  label="Timer (seconds)"
                  type="number"
                  name="timer_seconds"
                  value={form.timer_seconds || ''}
                  onChange={handleChange}
                  placeholder="30–86400"
                  min={30}
                  max={86400}
                  helper="Leave empty for no time limit."
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
                      className="w-11 h-11 rounded-xl cursor-pointer border border-gray-200 shrink-0"
                      aria-label="Theme color"
                    />
                    <input
                      name="theme_color"
                      value={form.theme_color || ''}
                      onChange={handleChange}
                      className="input-field font-mono"
                      placeholder="#6C5CE7"
                    />
                  </div>
                </div>
              </div>
              <div className="py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Opens at</label>
                    <input
                      type="datetime-local"
                      name="starts_at"
                      value={form.starts_at ? form.starts_at.replace(' ', 'T') : ''}
                      onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="field-label">Closes at</label>
                    <input
                      type="datetime-local"
                      name="ends_at"
                      value={form.ends_at ? form.ends_at.replace(' ', 'T') : ''}
                      onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              <div className="py-4">
                <Textarea
                  label="Thank you message"
                  name="thank_you_message"
                  value={form.thank_you_message || ''}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Thank you for filling out this form"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display font-semibold text-ink mb-4">Banner</h2>
            {form.banner_path ? (
              <img src={form.banner_path} alt="Banner" className="w-full h-36 object-cover rounded-xl mb-4" />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-36 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary"
              >
                <ImageUp className="w-6 h-6" />
                <span className="text-sm font-medium">Upload a banner</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleBanner} className="hidden" />
            {form.banner_path && (
              <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => fileRef.current?.click()} icon={<ImageUp className="w-4 h-4" />}>
                Change Banner
              </Button>
            )}
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-ink mb-3">Quick actions</h2>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate(`/forms/${id}/questions`)}>
                Manage questions
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate(`/forms/${id}/results`)}>
                View results
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => window.open(`/q/${form.short_code}`, '_blank')}>
                Open public page
              </Button>
            </div>
          </Card>
        </div>
      </div>

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
    </div>
  )
}
