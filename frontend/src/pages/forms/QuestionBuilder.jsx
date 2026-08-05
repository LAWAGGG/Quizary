import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, GripVertical, Upload, ArrowLeft, Check, HelpCircle, Trash2, Image as ImageIcon } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Button, Input, Textarea, Select, Toggle, Card, Badge, ConfirmModal, PageHeader, FormSubNav, EmptyState, CardSkeleton } from '../../components/ui'

const TYPE_LABELS = {
  multiple_choice: 'Multiple Choice',
  checkbox: 'Checkbox',
  short_answer: 'Short Answer',
  essay: 'Essay',
}

const TYPE_OPTIONS = ['multiple_choice', 'checkbox', 'short_answer', 'essay']

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function QuestionForm({ initial, onSave, onCancel, loading, isQuiz, errors, questionId }) {
  const toast = useToast()
  const [form, setForm] = useState({
    question_text: '',
    type: 'multiple_choice',
    points: 1,
    is_scored: true,
    is_required: true,
    options: [{ option_text: '', is_correct: false }],
    ...(initial || {}),
  })
  const isEditing = !!initial
  const ferr = (name) => errors?.[name]
  const optionsErr = Object.keys(errors || {}).some((k) => k.startsWith('options'))
  const optionsMsg = Object.values(errors || {}).find((v, i) => Object.keys(errors)[i]?.startsWith('options'))

  const optionFileRefs = useRef([])
  const [imgLoading, setImgLoading] = useState(null)

  const uploadOptionImage = async (opt, i) => {
    const file = optionFileRefs.current[i]?.files?.[0]
    if (!file || !opt.id || !questionId) return
    const fd = new FormData()
    fd.append('file', file)
    setImgLoading(`opt-${i}`)
    try {
      const res = await api.post(`/questions/${questionId}/option/${opt.id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Option image uploaded')
      setForm((prev) => ({
        ...prev,
        options: prev.options.map((o, idx) => (idx !== i ? o : { ...o, image: { path: res.data.image.path } })),
      }))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload')
    } finally {
      setImgLoading(null)
      if (optionFileRefs.current[i]) optionFileRefs.current[i].value = ''
    }
  }

  const questionFileRef = useRef(null)
  const [qImgLoading, setQImgLoading] = useState(false)

  const uploadQuestionImage = async () => {
    const file = questionFileRef.current?.files?.[0]
    if (!file || !questionId) return
    const fd = new FormData()
    fd.append('file', file)
    setQImgLoading(true)
    try {
      const res = await api.post(`/questions/${questionId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Question image uploaded')
      setForm((prev) => ({ ...prev, image: { path: res.data.image.path } }))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload')
    } finally {
      setQImgLoading(false)
      if (questionFileRef.current) questionFileRef.current.value = ''
    }
  }

  const handleTypeChange = (type) => {
    setForm((prev) => ({
      ...prev,
      type,
      options: type === 'multiple_choice' || type === 'checkbox'
        ? (prev.options.length ? prev.options : [{ option_text: '', is_correct: false }])
        : [],
    }))
  }

  const addOption = () => {
    setForm((prev) => ({ ...prev, options: [...prev.options, { option_text: '', is_correct: false }] }))
  }

  const removeOption = (i) => {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))
  }

  const setOption = (i, field, value) => {
    setForm((prev) => {
      if (field === 'is_correct' && prev.type === 'multiple_choice') {
        return { ...prev, options: prev.options.map((o, idx) => ({ ...o, is_correct: idx === i && value })) }
      }
      const opts = prev.options.map((o, idx) => (idx !== i ? o : { ...o, [field]: value }))
      return { ...prev, options: opts }
    })
  }

  const canSave = form.question_text.trim()
  const needsOptions = form.type === 'multiple_choice' || form.type === 'checkbox'
  const hasCorrect = form.options.some((o) => o.is_correct)

  return (
    <div className="space-y-5">
      <Select label="Question Type" value={form.type} onChange={(e) => handleTypeChange(e.target.value)} error={ferr('type')}>
        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </Select>

      <Textarea
        label="Question"
        value={form.question_text}
        onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
        rows={2}
        placeholder="Enter question text..."
        error={ferr('question_text')}
      />

      <div className="flex items-center gap-3">
        <input
          ref={questionFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!questionId}
          onChange={uploadQuestionImage}
        />
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); questionFileRef.current?.click() }}
          disabled={!questionId || qImgLoading}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500 hover:text-primary hover:border-primary transition-colors"
        >
          {qImgLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          {qImgLoading ? 'Uploading...' : form.image ? 'Replace question image' : 'Add question image'}
        </button>
        {form.image?.path && (
          <img src={form.image.path} alt="" className="h-10 w-14 object-cover rounded-md border border-gray-200" />
        )}
      </div>

      <div className="flex items-end gap-4">
        {isQuiz && (
          <div className="flex-1">
            {isEditing ? (
              <Input
                label="Points"
                type="number"
                value={form.points}
                onChange={(e) => setForm((p) => ({ ...p, points: parseInt(e.target.value) || 0 }))}
                min={0}
                max={999}
                disabled={!form.is_scored}
                helper={form.is_scored ? 'Other scored questions rebalance automatically.' : 'Turn on "Count points" to include this question.'}
                error={ferr('points')}
              />
            ) : (
              <div>
                <label className="field-label">Points</label>
                <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 h-11 flex items-center">
                  Auto-assigned by system
                </p>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2.5 h-11 pb-[1px]">
          {isQuiz && isEditing && (
            <>
              <span className="text-sm text-gray-600">Count points</span>
              <Toggle
                label="Count points"
                checked={form.is_scored}
                onChange={(v) => setForm((p) => ({ ...p, is_scored: v, points: v ? p.points : 0 }))}
              />
            </>
          )}
          <span className="text-sm text-gray-600">Required</span>
          <Toggle label="Required" checked={form.is_required} onChange={(v) => setForm((p) => ({ ...p, is_required: v }))} />
        </div>
      </div>

      {needsOptions && (
        <div className={`${optionsErr ? 'border border-incorrect rounded-xl p-3' : ''}`}>
          <div className="flex items-center justify-between mb-2.5">
            <label className="field-label !mb-0">
              Answer options
              <span className="ml-2 text-xs font-normal text-gray-400">
                {form.type === 'multiple_choice' ? 'pick one correct' : 'mark each correct'}
              </span>
            </label>
            <button type="button" onClick={addOption} className="text-sm font-medium text-primary hover:underline">
              + Add option
            </button>
          </div>
          <div className="space-y-2.5">
            {form.options.map((opt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5"
              >
                {form.type === 'checkbox' ? (
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg border-2 shrink-0 transition-colors ${
                    opt.is_correct ? 'border-correct bg-correct text-white' : 'border-gray-300 bg-white text-transparent'
                  }`}>
                    {opt.is_correct && <Check className="w-4 h-4" strokeWidth={3.5} />}
                  </span>
                ) : (
                  <span className={`bubble ${opt.is_correct ? 'bubble-correct' : 'bubble-empty'}`}>
                    {opt.is_correct ? <Check className="w-3.5 h-3.5" /> : LETTERS[i % LETTERS.length]}
                  </span>
                )}
                <input
                  type="text"
                  value={opt.option_text}
                  onChange={(e) => setOption(i, 'option_text', e.target.value)}
                  className="input-field flex-1"
                  placeholder={`Option ${LETTERS[i % LETTERS.length]}`}
                />
                {opt.image?.path && (
                  <img src={opt.image.path} alt="" className="w-9 h-9 object-cover rounded-md border border-gray-200 shrink-0" />
                )}
                <input
                  ref={(el) => (optionFileRefs.current[i] = el)}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!opt.id}
                  onChange={() => uploadOptionImage(opt, i)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    optionFileRefs.current[i]?.click()
                  }}
                  disabled={!opt.id || !!imgLoading}
                  title={opt.id ? 'Upload option image' : 'Save question first to add an image'}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    opt.image ? 'text-primary hover:bg-primary-soft' : 'text-gray-400 hover:text-primary hover:bg-primary-soft'
                  }`}
                >
                  {imgLoading === `opt-${i}` ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setOption(i, 'is_correct', !opt.is_correct)}
                  aria-label={opt.is_correct ? 'Mark as not correct' : 'Mark as correct'}
                  title={form.type === 'multiple_choice' ? 'Set as correct answer' : 'Toggle correct'}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    opt.is_correct ? 'bg-correct-soft text-correct' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {form.type === 'multiple_choice' ? (opt.is_correct ? 'Correct' : 'Correct?') : (opt.is_correct ? 'Correct' : 'Mark')}
                </button>
                {form.options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="w-9 h-9 rounded-lg text-gray-400 hover:text-incorrect hover:bg-incorrect-soft transition-colors text-lg leading-none"
                    aria-label="Remove option"
                  >
                    &times;
                  </button>
                )}
              </motion.div>
            ))}
          </div>
          {needsOptions && form.options.length > 0 && !hasCorrect && (
            <p className="text-xs text-warn mt-2">Mark at least one option as correct.</p>
          )}
          {optionsErr && optionsMsg && (
            <p className="text-xs font-medium text-incorrect mt-2">{optionsMsg}</p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={() => onSave({ ...form, options: form.options })} disabled={!canSave || loading} loading={loading} className="flex-1" size="md">
          {loading ? 'Saving...' : 'Save'}
        </Button>
        <Button onClick={onCancel} variant="secondary" size="md">Cancel</Button>
      </div>
    </div>
  )
}

function QuestionCard({ question, index, onEdit, onDelete, onDragStart, onDragOver, onDragEnd, isDragging, isQuiz, selected, onToggleSelect }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      <Card className={`cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'shadow-lift border-primary/40 opacity-60' : selected ? 'border-primary/50 shadow-card' : 'hover:border-gray-300'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-gray-300 cursor-grab"><GripVertical className="w-5 h-5" /></span>
            <span className="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <Badge scheme="gray">{TYPE_LABELS[question.type]}</Badge>
            {isQuiz && question.is_scored && question.points > 0 && (
              <span className="text-xs text-gray-400">{question.points} pts</span>
            )}
            {isQuiz && !question.is_scored && (
              <span className="text-xs text-gray-400">Not scored</span>
            )}
          </div>
          <div className="flex gap-1 shrink-0 items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(question.id)}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
              aria-label={`Select question ${index + 1}`}
            />
            <button onClick={() => onEdit(question)} className="text-xs font-medium text-gray-400 hover:text-primary px-2 py-1 transition-colors">Edit</button>
            <button onClick={() => onDelete(question)} className="text-xs font-medium text-gray-400 hover:text-incorrect px-2 py-1 transition-colors">Delete</button>
          </div>
        </div>

        <p className="text-[15px] font-medium text-ink mb-3">{question.question_text}</p>

        {question.options?.length > 0 && (
          <div className="space-y-1.5">
            {question.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2.5">
                {question.type === 'checkbox' ? (
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md border-2 shrink-0 ${opt.is_correct ? 'border-correct bg-correct text-white' : 'border-gray-300 text-transparent'}`}>
                    {opt.is_correct && <Check className="w-3 h-3" strokeWidth={3.5} />}
                  </span>
                ) : (
                  <span className={`bubble w-6 h-6 text-xs ${opt.is_correct ? 'bubble-correct' : 'bubble-empty'}`}>
                    {opt.is_correct ? <Check className="w-3 h-3" /> : LETTERS[i % LETTERS.length]}
                  </span>
                )}
                <span className={`text-sm ${opt.is_correct ? 'text-correct font-medium' : 'text-gray-600'}`}>
                  {opt.option_text}
                </span>
                {opt.image?.path && (
                  <img src={opt.image.path} alt="" className="w-6 h-6 object-cover rounded shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {question.image && (
          <img src={question.image.path} alt="" className="mt-3 max-h-32 rounded-xl object-cover" />
        )}
      </Card>
    </motion.div>
  )
}

export default function QuestionBuilder() {
  const { formId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const docxRef = useRef(null)

  const [form, setForm] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [reorderSaving, setReorderSaving] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get(`/forms/${formId}`),
      api.get(`/forms/${formId}/questions`),
    ])
      .then(([fRes, qRes]) => {
        setForm(fRes.data)
        setQuestions(qRes.data.data)
        setSelectedIds([])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  const handleSaveQuestion = async (data) => {
    setSaveLoading(true)
    setFieldErrors({})
    const payload = {
      question_text: data.question_text,
      type: data.type,
      points: data.points,
      is_scored: data.is_scored !== false,
      is_required: data.is_required,
      options: (data.type === 'multiple_choice' || data.type === 'checkbox')
        ? data.options.filter((o) => o.option_text.trim()).map((o) => ({
            ...(o.id ? { id: o.id } : {}),
            option_text: o.option_text,
            is_correct: o.is_correct,
          }))
        : [],
    }
    try {
      if (editing) {
        await api.put(`/questions/${editing.id}`, payload)
        toast.success('Question updated')
      } else {
        await api.post(`/forms/${formId}/questions`, payload)
        toast.success('Question added')
      }
      load()
      setShowForm(false)
      setEditing(null)
    } catch (err) {
      const data = err.response?.data
      if (data?.errors) {
        const mapped = {}
        data.errors.forEach((entry) => {
          Object.entries(entry).forEach(([k, v]) => { mapped[k] = v })
        })
        setFieldErrors(mapped)
        if (mapped._schema) toast.error(mapped._schema)
        else if (data.message) toast.error(data.message)
      } else {
        toast.error(data?.message || data?.detail || 'Failed to save question')
      }
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/questions/${deleteTarget.id}`)
      setDeleteTarget(null)
      toast.success('Question deleted')
      load()
    } catch {
      toast.error('Failed to delete question')
      setDeleteTarget(null)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSelected = questions.length > 0 && selectedIds.length === questions.length

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : questions.map((q) => q.id))
  }

  const handleBulkDelete = async () => {
    setShowBulkDelete(false)
    if (!selectedIds.length) return
    setBulkDeleting(true)
    try {
      for (const id of selectedIds) {
        await api.delete(`/questions/${id}`)
      }
      toast.success(`${selectedIds.length} question(s) deleted`)
      setSelectedIds([])
      load()
    } catch {
      toast.error('Failed to delete some questions')
      setSelectedIds([])
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const reordered = [...questions]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setQuestions(reordered)
    setDragIdx(idx)
  }

  const handleDragEnd = async () => {
    setDragIdx(null)
    const orders = questions.map((q) => q.id)
    setReorderSaving(true)
    try {
      await api.patch('/questions/reorder', { form_id: parseInt(formId), orders })
    } catch {
      load()
    } finally {
      setReorderSaving(false)
    }
  }

  const handleDocxImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/forms/${formId}/import/docx`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Questions imported')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to import DOCX')
    }
  }

  const editQuestion = (q) => {
    setEditing(q)
    setShowForm(true)
    setFieldErrors({})
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200/60 rounded-xl w-1/3 animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (!form) return null

  return (
    <div>
      <button
        onClick={() => navigate(`/forms/${formId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to settings
      </button>

      <PageHeader
        eyebrow={form.type === 'quiz' ? 'Quiz builder' : 'Form builder'}
        title={form.title}
        description={`${questions.length} question${questions.length !== 1 ? 's' : ''} · drag to reorder`}
        actions={
          <>
            <input ref={docxRef} type="file" accept=".docx" onChange={handleDocxImport} className="hidden" />
            <Button variant="secondary" onClick={() => docxRef.current?.click()} icon={<Upload className="w-4 h-4" />}>
              Import DOCX
            </Button>
              <Button onClick={() => { setEditing(null); setShowForm(true); setFieldErrors({}) }} icon={<Plus className="w-4 h-4" />}>
              Add Question
            </Button>
          </>
        }
      />

      <FormSubNav formId={formId} className="mt-5" />

      {reorderSaving && (
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl mt-4 text-sm flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Saving order...
        </div>
      )}

      <AnimatePresence>
        {showForm && !editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-6"
          >
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <span className="w-6 h-6 rounded-full bg-primary-50 text-primary text-xs font-bold flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </span>
                <h3 className="font-display font-semibold text-ink">Add New Question</h3>
              </div>
              <QuestionForm
                onSave={(data) => handleSaveQuestion(data)}
                onCancel={() => { setShowForm(false); setEditing(null) }}
                loading={saveLoading}
                isQuiz={form.type === 'quiz'}
                errors={fieldErrors}
                questionId={editing?.id}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {questions.length === 0 && !showForm ? (
        <Card className="mt-6">
          <EmptyState
            icon={<HelpCircle className="w-6 h-6" />}
            title="No questions yet"
            description="Add your first question, or import one from a DOCX file."
            action={
            <Button onClick={() => { setEditing(null); setShowForm(true); setFieldErrors({}) }} icon={<Plus className="w-4 h-4" />}>
                Add Question
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="sticky top-0 z-20 mt-6 bg-white border border-gray-200 shadow-lift rounded-2xl px-4 py-3 flex items-center gap-3"
            >
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded accent-primary"
                />
                Select all ({selectedIds.length}/{questions.length})
              </label>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={() => setShowBulkDelete(true)} icon={<Trash2 className="w-4 h-4" />}>
                  Delete ({selectedIds.length})
                </Button>
              </div>
            </motion.div>
          )}
          <div className="space-y-3 mt-6">
            {questions.map((q, i) => (
              <div key={q.id}>
                <QuestionCard
                  question={q}
                  index={i}
                  onEdit={editQuestion}
                  onDelete={setDeleteTarget}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  isDragging={dragIdx === i}
                  isQuiz={form.type === 'quiz'}
                  selected={selectedIds.includes(q.id)}
                  onToggleSelect={toggleSelect}
                />
              <AnimatePresence>
                {showForm && editing?.id === q.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <Card>
                      <h3 className="font-display font-semibold text-ink mb-5">Edit Question {i + 1}</h3>
                      <QuestionForm
                        initial={{
                          question_text: q.question_text,
                          type: q.type,
                          points: q.points,
                          is_scored: q.is_scored !== false,
                          is_required: q.is_required,
                          image: q.image,
                          options: q.options?.length
                            ? q.options.map((o) => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct, image: o.image }))
                            : [{ option_text: '', is_correct: false }],
                        }}
                        onSave={(data) => handleSaveQuestion(data)}
                        onCancel={() => { setShowForm(false); setEditing(null) }}
                        loading={saveLoading}
                        isQuiz={form.type === 'quiz'}
                        errors={fieldErrors}
                        questionId={q.id}
                      />
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          </div>
        </>
      )}

      <ConfirmModal
        show={showBulkDelete}
        title={`Delete ${selectedIds.length} question(s)?`}
        message={
          <div>
            <p>This will permanently delete the selected questions. Review the list below:</p>
            <ul className="mt-2 space-y-1 max-h-44 overflow-y-auto pr-1">
              {questions.filter((q) => selectedIds.includes(q.id)).map((q) => (
                <li key={q.id} className="flex items-start gap-2 text-xs text-gray-600 leading-snug">
                  <span className="w-1.5 h-1.5 rounded-full bg-incorrect shrink-0 mt-1" />
                  <span className="line-clamp-2">{q.question_text}</span>
                </li>
              ))}
            </ul>
          </div>
        }
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDelete(false)}
        loading={bulkDeleting}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmModal
        show={!!deleteTarget}
        title="Delete Question?"
        message={`Delete question "${deleteTarget?.question_text?.slice(0, 50)}..."?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
