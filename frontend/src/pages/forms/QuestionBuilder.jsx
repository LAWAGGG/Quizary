import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, GripVertical, Upload, ArrowLeft, Check, HelpCircle, Trash2, Image as ImageIcon, X, Layers, Download, BookOpen, Unlink } from 'lucide-react'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, useDroppable, closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { isAudioUrl } from '../../lib/media'
import { Button, Input, Select, Toggle, Card, Badge, ConfirmModal, PageHeader, FormSubNav, EmptyState, CardSkeleton, RichTextEditor, RichText } from '../../components/ui'
import SectionManager from '../../components/ui/SectionManager'

const TYPE_LABELS = {
  multiple_choice: 'Multiple Choice',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
  short_answer: 'Short Answer',
  essay: 'Essay',
  date: 'Date',
  time: 'Time',
  file_upload: 'File Upload',
}

const TYPE_OPTIONS = ['multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'date', 'time', 'file_upload']
const OPTION_TYPES = ['multiple_choice', 'checkbox', 'dropdown']
const NO_GRADE_TYPES = ['essay', 'date', 'time', 'file_upload']

const TYPE_HINTS = {
  dropdown: 'Responden memilih satu jawaban dari daftar dropdown.',
  date: 'Responden memilih tanggal (YYYY-MM-DD).',
  time: 'Responden memilih waktu (HH:MM).',
  file_upload: 'Responden mengunggah file (pdf, doc, xls, ppt, txt, csv, gambar, zip).',
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function QuestionForm({ initial, onSave, onCancel, loading, isQuiz, errors, questionId, sections, sectionsAllowed }) {
  const toast = useToast()
  // Satu-satunya section = default tujuan soal baru; select section tak perlu tampil.
  const singleSectionId = sectionsAllowed && sections?.length === 1 ? sections[0].id : null
  const [form, setForm] = useState({
    question_text: '',
    type: 'multiple_choice',
    points: 1,
    is_scored: true,
    is_required: true,
    options: [{ option_text: '', is_correct: false }],
    ...(initial || {}),
    section_id: initial?.section_id || singleSectionId,
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
      toast.success('Media uploaded')
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
      options: OPTION_TYPES.includes(type)
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
      if (field === 'is_correct' && (prev.type === 'multiple_choice' || prev.type === 'dropdown')) {
        return { ...prev, options: prev.options.map((o, idx) => ({ ...o, is_correct: idx === i && value })) }
      }
      const opts = prev.options.map((o, idx) => (idx !== i ? o : { ...o, [field]: value }))
      return { ...prev, options: opts }
    })
  }

  const textOnly = (html) => (html || '').replace(/<[^>]*>/g, '').trim()
  const canSave = !!textOnly(form.question_text)
  const needsOptions = OPTION_TYPES.includes(form.type)
  const noGrade = NO_GRADE_TYPES.includes(form.type)
  const hasCorrect = form.options.some((o) => o.is_correct)

  return (
    <div className="space-y-5">
      <Select label="Question Type" value={form.type} onChange={(e) => handleTypeChange(e.target.value)} error={ferr('type')}>
        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </Select>
      {TYPE_HINTS[form.type] && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3">{TYPE_HINTS[form.type]}</p>
      )}

      {sectionsAllowed && sections?.length > 1 && (
        <div>
          <label className="field-label">Section</label>
          <select
            value={form.section_id || ''}
            onChange={(e) => setForm((p) => ({ ...p, section_id: e.target.value ? parseInt(e.target.value) : null }))}
            className="input-field"
          >
            <option value="">— No section —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="field-label">Question</label>
        <RichTextEditor
          value={form.question_text}
          onChange={(html) => setForm((p) => ({ ...p, question_text: html }))}
          placeholder="Enter question text..."
        />
        {ferr('question_text') && <p className="field-error">{ferr('question_text')}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={questionFileRef}
          type="file"
          accept="image/*,audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm"
          className="hidden"
          disabled={!questionId}
          onChange={uploadQuestionImage}
        />
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); questionFileRef.current?.click() }}
          disabled={!questionId || qImgLoading}
          title={questionId ? 'Unggah gambar atau audio (mp3)' : 'Save question first to add media'}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary transition-colors"
        >
          {qImgLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          {qImgLoading ? 'Uploading...' : form.image ? 'Replace image / audio' : 'Add image or audio'}
        </button>
        {form.image?.path && (isAudioUrl(form.image.path) ? (
          <audio controls src={form.image.path} preload="metadata" className="h-10 max-w-[240px] flex-1 min-w-0" />
        ) : (
          <img src={form.image.path} alt="" className="h-10 w-14 object-cover rounded-md border border-gray-200 dark:border-gray-700" />
        ))}
      </div>

      <div className="flex items-end gap-4">
        {isQuiz && !noGrade && (
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
                <p className="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-ink-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 h-11 flex items-center">
                  Auto-assigned by system
                </p>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2.5 h-11 pb-[1px]">
          {isQuiz && isEditing && !noGrade && (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-400">Count points</span>
              <Toggle
                label="Count points"
                checked={form.is_scored}
                onChange={(v) => setForm((p) => ({ ...p, is_scored: v, points: v ? p.points : 0 }))}
              />
            </>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">Required</span>
          <Toggle label="Required" checked={form.is_required} onChange={(v) => setForm((p) => ({ ...p, is_required: v }))} />
        </div>
      </div>

      {needsOptions && (
        <div className={`${optionsErr ? 'border border-incorrect rounded-xl p-3' : ''}`}>
          <div className="flex items-center justify-between mb-2.5">
            <label className="field-label !mb-0">
              Answer options
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
                  <button
                    type="button"
                    onClick={() => setOption(i, 'is_correct', !opt.is_correct)}
                    aria-label={opt.is_correct ? 'Hapus tanda jawaban benar' : 'Tandai sebagai jawaban benar'}
                    title={opt.is_correct ? 'Hapus tanda jawaban benar' : 'Tandai sebagai jawaban benar'}
                    className="shrink-0 rounded-lg transition-transform hover:scale-105 active:scale-95"
                  >
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg border-2 transition-colors ${opt.is_correct ? 'border-correct bg-correct text-white' : 'border-gray-300 bg-white dark:bg-ink-900 text-transparent hover:border-primary/60'
                      }`}>
                      {opt.is_correct && <Check className="w-4 h-4" strokeWidth={3.5} />}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOption(i, 'is_correct', !opt.is_correct)}
                    aria-label={opt.is_correct ? 'Hapus tanda jawaban benar' : 'Tandai sebagai jawaban benar'}
                    title={opt.is_correct ? 'Hapus tanda jawaban benar' : 'Tandai sebagai jawaban benar'}
                    className="shrink-0 transition-transform hover:scale-105 active:scale-95"
                  >
                    <span className={`bubble ${opt.is_correct ? 'bubble-correct' : 'bubble-empty'}`}>
                      {opt.is_correct ? <Check className="w-3.5 h-3.5" /> : LETTERS[i % LETTERS.length]}
                    </span>
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <RichTextEditor
                    value={opt.option_text}
                    onChange={(html) => setOption(i, 'option_text', html)}
                    placeholder={`Option ${LETTERS[i % LETTERS.length]}`}
                    compact
                    minHeight={48}
                  />
                </div>
                {opt.image?.path && (
                  <img src={opt.image.path} alt="" className="w-9 h-9 object-cover rounded-md border border-gray-200 dark:border-gray-700 shrink-0" />
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
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${opt.image ? 'text-primary hover:bg-primary-soft' : 'text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-primary-soft'
                    }`}
                >
                  {imgLoading === `opt-${i}` ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </button>
                {form.options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="w-9 h-9 rounded-lg text-gray-400 dark:text-gray-500 hover:text-incorrect hover:bg-incorrect-soft transition-colors text-lg leading-none"
                    aria-label="Remove option"
                  >
                    &times;
                  </button>
                )}
              </motion.div>
            ))}
          </div>
          {needsOptions && form.options.length > 0 && !hasCorrect && isQuiz && form.is_scored && (
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

function QuestionCard({ question, index, onEdit, isDragging, isQuiz, selected, onToggleSelect, groupId, groupSize }) {
  return (
    <Card className={`transition-all ${isDragging ? 'shadow-lift border-primary/40 opacity-60' : selected ? 'border-primary/50 shadow-card' : 'hover:border-gray-300 dark:hover:border-gray-700'} ${groupId ? 'border-l-4 !border-l-primary/50' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <Badge scheme="gray">{TYPE_LABELS[question.type]}</Badge>
          {groupId && (
            <Badge scheme="primary" title="Soal grup cerita selalu tampil berurutan meski shuffle aktif. Select soal lalu klik Ungroup untuk mengeluarkan.">
              <BookOpen className="w-3 h-3" />
              Grup cerita · {groupSize} soal
            </Badge>
          )}
          {isQuiz && question.is_scored && question.points > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{question.points} pts</span>
          )}
          {isQuiz && !question.is_scored && (
            <span className="text-xs text-gray-400 dark:text-gray-500">Not scored</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0 items-center">
          <button onClick={() => onEdit(question)} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-primary px-2 py-1 transition-colors">Edit</button>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(question.id)}
            className="w-4 h-4 rounded accent-primary cursor-pointer"
            aria-label={`Select question ${index + 1}`}
          />
        </div>
      </div>

      <RichText html={question.question_text} className="rich-text block text-[15px] font-medium text-ink dark:text-gray-100 mb-3" />
{question.image && (isAudioUrl(question.image.path) ? (
        <audio controls src={question.image.path} preload="metadata" className="w-full max-w-sm mb-3" />
      ) : (
        <img src={question.image.path} alt="" className="mb-3 max-h-32 rounded-xl object-cover" />
      ))}
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
              <span className={`text-sm ${opt.is_correct ? 'text-correct font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                <RichText html={opt.option_text} className="rich-text" />
              </span>
              {opt.image?.path && (
                <img src={opt.image.path} alt="" className="w-6 h-6 object-cover rounded shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function SortableQuestionCard({ question, index, onEdit, isQuiz, selected, onToggleSelect, groupId, groupSize }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    data: { type: 'question', questionId: question.id },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="relative"
      >
        <span
          {...listeners}
          ref={setActivatorNodeRef}
          className="absolute left-0 top-3 bottom-3 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </span>
        <div className="pl-7">
          <QuestionCard
            question={question}
            index={index}
            onEdit={onEdit}
            isDragging={isDragging}
            isQuiz={isQuiz}
            selected={selected}
            onToggleSelect={onToggleSelect}
            groupId={groupId}
            groupSize={groupSize}
          />
        </div>
      </div>
    </motion.div>
  )
}

function QuestionItem({ q, index, onEdit, isQuiz, selected, onToggleSelect, editOpen, onSave, onCancel, saveLoading, errors, sections, sectionsAllowed, groupId, groupSize }) {
  if (editOpen) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/50 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <h3 className="font-display font-semibold text-ink dark:text-gray-100">Edit Question {index + 1}</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 -mr-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Cancel edit"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <QuestionForm
            initial={{
              question_text: q.question_text,
              type: q.type,
              points: q.points,
              is_scored: q.is_scored !== false,
              is_required: q.is_required,
              section_id: q.section_id || null,
              image: q.image,
              options: q.options?.length
                ? q.options.map((o) => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct, image: o.image }))
                : [{ option_text: '', is_correct: false }],
            }}
            onSave={onSave}
            onCancel={onCancel}
            loading={saveLoading}
            isQuiz={isQuiz}
            errors={errors}
            questionId={q.id}
            sections={sections}
            sectionsAllowed={sectionsAllowed}
          />
        </Card>
      </motion.div>
    )
  }

  return (
    <SortableQuestionCard
      question={q}
      index={index}
      onEdit={onEdit}
      isQuiz={isQuiz}
      selected={selected}
      onToggleSelect={onToggleSelect}
      groupId={groupId}
      groupSize={groupSize}
    />
  )
}

function SectionHeader({ section, count, editing, draft, setDraft, onEdit, onSave, onCancel, onDelete }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-2.5">
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
            className="input-field h-9 text-sm flex-1"
            autoFocus
            placeholder="Nama section"
          />
          <Button size="sm" onClick={onSave} icon={<Check className="w-3.5 h-3.5" />}>Simpan</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Batal</Button>
        </>
      ) : (
        <>
          <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
          <h3 className="font-display font-semibold text-ink dark:text-gray-100 flex-1 truncate">
            {section ? section.title : 'General'}
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{count} soal</span>
          {section && (
            <>
              <button onClick={onEdit} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-primary px-2 py-1 transition-colors">Rename</button>
              <button onClick={onDelete} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-incorrect px-2 py-1 transition-colors">Delete</button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SectionDropZone({ sectionId, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${sectionId ?? 'none'}`,
    data: { type: 'section', sectionId: sectionId ?? null },
  })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl -mx-3 px-3 transition-all ${isOver ? 'ring-2 ring-primary/40 bg-primary-50/40 dark:bg-primary-900/20' : ''}`}
    >
      {children}
    </div>
  )
}

export default function QuestionBuilder() {
  const { formId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const docxRef = useRef(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSectionId, setImportSectionId] = useState('')

  const [form, setForm] = useState(null)
  const [questions, setQuestions] = useState([])
  const [sections, setSections] = useState([])
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [sectionTitleDraft, setSectionTitleDraft] = useState('')
  const [sectionDeleteTarget, setSectionDeleteTarget] = useState(null)
  const [sectionSaving, setSectionSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [reorderSaving, setReorderSaving] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [showSectionManager, setShowSectionManager] = useState(false)
  const [activeDrag, setActiveDrag] = useState(null)
  const [grouping, setGrouping] = useState(false)
  const [ungrouping, setUngrouping] = useState(false)

  // Sections hanya untuk: semua quiz (style apapun), atau form + card
  const sectionsAllowed = form && (
    form.type === 'quiz' ||
    (form.type === 'form' && (form.display_style || 'card') === 'card')
  )
  // Import DOCX wajib pilih section tujuan hanya bila section >1.
  const importNeedsSection = sectionsAllowed && sections.length > 1

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    Promise.all([
      api.get(`/forms/${formId}`),
      api.get(`/forms/${formId}/questions`),
      api.get(`/forms/${formId}/sections`),
    ])
      .then(([fRes, qRes, sRes]) => {
        setForm(fRes.data)
        setQuestions(qRes.data.data)
        setSections(sRes.data.data)
        setSelectedIds([])
      })
      .catch(() => { })
      .finally(() => { if (!silent) setLoading(false) })
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
      section_id: data.section_id || null,
      options: OPTION_TYPES.includes(data.type)
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

  // Loading bersama untuk ConfirmModal (delete soal / section) — hanya satu
  // modal konfirmasi yang bisa terbuka pada satu waktu.
  const [confirmLoading, setConfirmLoading] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setConfirmLoading(true)
    try {
      await api.delete(`/questions/${deleteTarget.id}`)
      setDeleteTarget(null)
      toast.success('Question deleted')
      load()
    } catch {
      toast.error('Failed to delete question')
      setDeleteTarget(null)
    } finally {
      setConfirmLoading(false)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Grup cerita: hitung anggota per group_id untuk badge kartu
  const groupCounts = {}
  questions.forEach((q) => {
    if (q.group_id) groupCounts[q.group_id] = (groupCounts[q.group_id] || 0) + 1
  })

  const selectedQs = questions.filter((q) => selectedIds.includes(q.id))
  const selectionGrouped = selectedQs.some((q) => q.group_id)
  const canGroup =
    !selectionGrouped &&
    selectedQs.length >= 2 &&
    selectedQs.every((q) => q.section_id) &&
    new Set(selectedQs.map((q) => q.section_id)).size === 1

  const handleGroup = async () => {
    setGrouping(true)
    try {
      await api.post(`/forms/${formId}/questions/group`, { question_ids: selectedIds })
      toast.success(`${selectedIds.length} soal dikelompokkan sebagai satu grup cerita`)
      setSelectedIds([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Gagal mengelompokkan soal')
    } finally {
      setGrouping(false)
    }
  }

  const handleUngroupSelected = async () => {
    const groupedQs = selectedQs.filter((q) => q.group_id)
    if (!groupedQs.length) return
    setUngrouping(true)
    try {
      for (const q of groupedQs) {
        await api.delete(`/forms/${formId}/questions/group/${q.group_id}/questions/${q.id}`)
      }
      toast.success(`${groupedQs.length} soal dikeluarkan dari grup`)
      setSelectedIds([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengeluarkan soal dari grup')
    } finally {
      setUngrouping(false)
    }
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

  const handleDragStart = (event) => {
    const data = event.active.data.current || {}
    setActiveDrag({
      type: data.type,
      questionId: data.questionId,
      id: event.active.id,
    })
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'question') return
    const activeId = active.id
    const overId = over.id
    if (activeId === overId) return
    const activeIndex = questions.findIndex((q) => q.id === activeId)
    const overIndex = questions.findIndex((q) => q.id === overId)
    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      setQuestions((prev) => arrayMove(prev, activeIndex, overIndex))
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveDrag(null)
    if (!over) return

    const type = active.data.current?.type

    if (type === 'question') {
      const movedQuestionId = active.id
      const overData = over.data.current

      if (overData?.type === 'section') {
        const toSection = overData.sectionId ?? null
        const q = questions.find((qq) => qq.id === movedQuestionId)
        if (q && q.section_id !== toSection) {
          try {
            await api.put(`/questions/${movedQuestionId}`, { section_id: toSection })
            toast.success('Question moved to another section')
            load(true)
            return
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to move question')
            load(true)
            return
          }
        }
        return
      }

      setReorderSaving(true)
      try {
        await api.patch('/questions/reorder', { form_id: parseInt(formId), orders: questions.map((q) => q.id) })
      } catch {
        load(true)
      } finally {
        setReorderSaving(false)
      }
    }
  }

  const handleDragCancel = () => setActiveDrag(null)

  const handleDocxImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    // Section >1: tujuan import wajib dipilih (divalidasi juga di backend).
    if (importNeedsSection && !importSectionId) {
      toast.error('Pilih section tujuan terlebih dahulu')
      return
    }
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    if (importSectionId) fd.append('section_id', importSectionId)
    try {
      await api.post(`/forms/${formId}/import/docx`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setShowImportModal(false)
      setImportSectionId('')
      toast.success('Questions imported')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to import DOCX')
    } finally {
      setImporting(false)
    }
  }

  const editQuestion = (q) => {
    setEditing(q)
    setShowForm(true)
    setFieldErrors({})
  }

  const createSection = async () => {
    if (!newSectionTitle.trim()) return
    setSectionSaving(true)
    try {
      await api.post(`/forms/${formId}/sections`, { title: newSectionTitle.trim() })
      setNewSectionTitle('')
      setNewSectionOpen(false)
      toast.success('Section ditambahkan')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menambah section')
    } finally {
      setSectionSaving(false)
    }
  }

  const renameSection = async (section) => {
    if (!sectionTitleDraft.trim()) return
    try {
      await api.patch(`/sections/${section.id}`, { title: sectionTitleDraft.trim() })
      setEditingSectionId(null)
      toast.success('Section diperbarui')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memperbarui section')
    }
  }

  const deleteSection = async () => {
    if (!sectionDeleteTarget) return
    setConfirmLoading(true)
    try {
      await api.delete(`/sections/${sectionDeleteTarget.id}`)
      setSectionDeleteTarget(null)
      toast.success('Section dihapus')
      load()
    } catch {
      toast.error('Gagal menghapus section')
      setSectionDeleteTarget(null)
    } finally {
      setConfirmLoading(false)
    }
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
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 transition-colors mb-4"
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
            <Button variant="secondary" onClick={() => { if (docxRef.current) docxRef.current.value = ''; setShowImportModal(true) }} icon={<Upload className="w-4 h-4" />}>
              Import DOCX
            </Button>
            {sectionsAllowed && (
              <Button variant="secondary" onClick={() => setShowSectionManager(true)} icon={<Layers className="w-4 h-4" />}>
                Manage Sections
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setShowForm(true); setFieldErrors({}) }} icon={<Plus className="w-4 h-4" />}>
              Add Question
            </Button>
          </>
        }
      />

      <FormSubNav formId={formId} className="mt-5" />

      <SectionManager
        formId={formId}
        show={showSectionManager}
        onClose={() => setShowSectionManager(false)}
        sections={sections}
        questions={questions}
        onSaved={() => load(true)}
      />

      {newSectionOpen && (
        <div className="flex gap-2 mt-4">
          <input
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createSection() }}
            className="input-field flex-1"
            placeholder="Nama section, contoh: Bagian A"
            autoFocus
          />
          <Button onClick={createSection} loading={sectionSaving} disabled={!newSectionTitle.trim()}>Tambah</Button>
          <Button variant="ghost" onClick={() => setNewSectionOpen(false)}>Batal</Button>
        </div>
      )}

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
                <h3 className="font-display font-semibold text-ink dark:text-gray-100">Add New Question</h3>
              </div>
              <QuestionForm
                onSave={(data) => handleSaveQuestion(data)}
                onCancel={() => { setShowForm(false); setEditing(null) }}
                loading={saveLoading}
                isQuiz={form.type === 'quiz'}
                errors={fieldErrors}
                questionId={editing?.id}
                sections={sections}
                sectionsAllowed={sectionsAllowed}
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
              className="sticky top-0 z-20 mt-6 bg-white dark:bg-ink-900 border border-gray-200 dark:border-gray-700 shadow-lift rounded-2xl px-4 py-3 flex items-center gap-3"
            >
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
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
                {selectionGrouped ? (
                  <Button
                    variant="soft"
                    size="sm"
                    icon={<Unlink className="w-4 h-4" />}
                    loading={ungrouping}
                    onClick={handleUngroupSelected}
                    title="Keluarkan soal terpilih dari grup ceritanya"
                  >
                    Ungroup
                  </Button>
                ) : (
                  <Button
                    variant="soft"
                    size="sm"
                    icon={<BookOpen className="w-4 h-4" />}
                    loading={grouping}
                    disabled={!canGroup}
                    onClick={handleGroup}
                    title={canGroup ? 'Kelompokkan soal terpilih (cerita/wacana bersama)' : 'Pilih minimal 2 soal dalam section yang sama'}
                  >
                    Group
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => setShowBulkDelete(true)} icon={<Trash2 className="w-4 h-4" />}>
                  Delete ({selectedIds.length})
                </Button>
              </div>
            </motion.div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-8 mt-6">
                {sectionsAllowed ? (
                  <>
                    {sections.map((sec) => {
                      const secQs = questions.filter((q) => q.section_id === sec.id)
                      if (!secQs.length) return null
                      return (
                        <SectionDropZone key={sec.id} sectionId={sec.id}>
                          <SectionHeader
                            section={sec}
                            count={secQs.length}
                            editing={editingSectionId === sec.id}
                            draft={sectionTitleDraft}
                            setDraft={setSectionTitleDraft}
                            onEdit={() => { setEditingSectionId(sec.id); setSectionTitleDraft(sec.title) }}
                            onSave={() => renameSection(sec)}
                            onCancel={() => setEditingSectionId(null)}
                            onDelete={() => setSectionDeleteTarget(sec)}
                          />
                          <div className="space-y-3 mt-3">
                            {secQs.map((q) => (
                              <QuestionItem
                                key={q.id}
                                q={q}
                                index={questions.indexOf(q)}
                                onEdit={editQuestion}
                                isQuiz={form.type === 'quiz'}
                                selected={selectedIds.includes(q.id)}
                                onToggleSelect={toggleSelect}
                                editOpen={showForm && editing?.id === q.id}
                                onSave={(data) => handleSaveQuestion(data)}
                                onCancel={() => { setShowForm(false); setEditing(null) }}
                                saveLoading={saveLoading}
                                errors={fieldErrors}
                                sections={sections}
                                  groupId={q.group_id || null}
                                  groupSize={q.group_id ? (groupCounts[q.group_id] || 0) : 0}
                                />
                            ))}
                          </div>
                        </SectionDropZone>
                      )
                    })}
                    {(() => {
                      const unassigned = questions.filter((q) => !q.section_id)
                      if (!unassigned.length) return null
                      return (
                        <SectionDropZone key="unassigned" sectionId={null}>
                          <SectionHeader
                            section={null}
                            count={unassigned.length}
                            editing={false}
                            draft=""
                            setDraft={() => { }}
                            onEdit={() => { }}
                            onSave={() => { }}
                            onCancel={() => { }}
                            onDelete={() => { }}
                          />
                          <div className="space-y-3 mt-3">
                            {unassigned.map((q) => (
                              <QuestionItem
                                key={q.id}
                                q={q}
                                index={questions.indexOf(q)}
                                onEdit={editQuestion}
                                isQuiz={form.type === 'quiz'}
                                selected={selectedIds.includes(q.id)}
                                onToggleSelect={toggleSelect}
                                editOpen={showForm && editing?.id === q.id}
                                onSave={(data) => handleSaveQuestion(data)}
                                onCancel={() => { setShowForm(false); setEditing(null) }}
                                saveLoading={saveLoading}
                                errors={fieldErrors}
                                sections={sections}
                                sectionsAllowed={sectionsAllowed}
                              />
                            ))}
                          </div>
                        </SectionDropZone>
                      )
                    })()}
                  </>
                ) : (
                  questions.map((q) => (
                              <QuestionItem
                                key={q.id}
                                q={q}
                                index={questions.indexOf(q)}
                                onEdit={editQuestion}
                                isQuiz={form.type === 'quiz'}
                                selected={selectedIds.includes(q.id)}
                                onToggleSelect={toggleSelect}
                                editOpen={showForm && editing?.id === q.id}
                                onSave={(data) => handleSaveQuestion(data)}
                                onCancel={() => { setShowForm(false); setEditing(null) }}
                                saveLoading={saveLoading}
                                 errors={fieldErrors}
                                 sections={sections}
                                 sectionsAllowed={sectionsAllowed}
                                 groupId={q.group_id || null}
                                 groupSize={q.group_id ? (groupCounts[q.group_id] || 0) : 0}
                               />
                   ))
                 )}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDrag?.type === 'question' && (() => {
                const q = questions.find((qq) => qq.id === activeDrag.id)
                return q ? (
                  <Card className="shadow-lift border-primary/40">
                    <div className="flex items-center gap-3">
                      <span className="text-primary"><GripVertical className="w-5 h-5" /></span>
                      <Badge scheme="gray">{TYPE_LABELS[q.type]}</Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[240px]">
                        {(q.question_text || '').replace(/<[^>]*>/g, '').trim()}
                      </span>
                    </div>
                  </Card>
                ) : null
              })()}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <ConfirmModal
        show={!!sectionDeleteTarget}
        title="Hapus Section?"
        message={`Section "${sectionDeleteTarget?.title || ''}" akan dihapus. Soal di dalamnya tetap ada, hanya lepas dari section mana pun.`}
        onConfirm={deleteSection}
        onCancel={() => setSectionDeleteTarget(null)}
        loading={confirmLoading}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmModal
        show={showBulkDelete}
        title={`Delete ${selectedIds.length} question(s)?`}
        message={
          <div>
            <p>This will permanently delete the selected questions. Review the list below:</p>
            <ul className="mt-2 space-y-1 max-h-44 overflow-y-auto pr-1">
              {questions.filter((q) => selectedIds.includes(q.id)).map((q) => (
                <li key={q.id} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 leading-snug">
                  <span className="w-1.5 h-1.5 rounded-full bg-incorrect shrink-0 mt-1" />
                  <span className="line-clamp-2">{(q.question_text || '').replace(/<[^>]*>/g, '').trim()}</span>
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
        message={`Delete question "${(deleteTarget?.question_text || '').replace(/<[^>]*>/g, '').slice(0, 50)}..."?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={confirmLoading}
        confirmText="Delete"
        variant="danger"
      />

      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
            onClick={() => { if (!importing) setShowImportModal(false) }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-2xl max-h-[88dvh] flex flex-col shadow-lift"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100">Import Questions from Word</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Follow the format below so every question imports correctly</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (!importing) setShowImportModal(false) }}
                  className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {importNeedsSection && (
                  <section>
                    <label className="field-label">Section tujuan *</label>
                    <select
                      value={importSectionId}
                      onChange={(e) => setImportSectionId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">— Pilih section —</option>
                      {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      Semua soal hasil import akan masuk ke section ini.
                    </p>
                  </section>
                )}
                <section>
                  <h4 className="text-sm font-semibold text-ink dark:text-gray-100 mb-2">How it works</h4>
                  <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    <li className="flex gap-2"><Check className="w-4 h-4 text-correct shrink-0 mt-0.5" />Each question starts with a number followed by a period or closing bracket — e.g. <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ink-800 rounded text-xs font-mono">1.</code> or <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ink-800 rounded text-xs font-mono">1)</code>.</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-correct shrink-0 mt-0.5" />Answer choices are listed with letters — e.g. <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ink-800 rounded text-xs font-mono">A.</code>, <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ink-800 rounded text-xs font-mono">B.</code>, etc.</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-correct shrink-0 mt-0.5" />Mark the correct answer with a line like <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ink-800 rounded text-xs font-mono">Answer: B</code> or <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ink-800 rounded text-xs font-mono">Kunci Jawaban: B</code>.</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-correct shrink-0 mt-0.5" />Multiple correct choices become a checkbox question automatically.</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-correct shrink-0 mt-0.5" />Questions without any choices become essay questions.</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-correct shrink-0 mt-0.5" />Both manually typed numbers and Word's native auto-numbered lists are supported.</li>
                  </ul>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-ink dark:text-gray-100 mb-2">Example format</h4>
                  <div className="rounded-xl bg-gray-50 dark:bg-ink-800/60 border border-gray-200 dark:border-gray-700 p-4 font-mono text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre">
                    {`1. What is the capital of France?
   A. London
   B. Paris
   C. Berlin
   D. Madrid
   Answer: B

2. Which of the following are prime numbers?
   A. 2
   B. 4
   C. 7
   D. 9
   Answer: A, C

3. Explain how photosynthesis works.
`}
                  </div>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Question 1 → multiple choice · Question 2 → checkbox (two correct answers) · Question 3 → essay
                  </p>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-ink dark:text-gray-100 mb-2">Notes</h4>
                  <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed list-disc pl-4">
                    <li>Only <span className="font-mono">.docx</span> files are accepted.</li>
                    <li>Imported questions are appended at the end of the current list.</li>
                    <li>For quizzes, points are redistributed automatically across all scored questions.</li>
                    <li>If nothing can be parsed, the import is cancelled and you will be notified.</li>
                  </ul>
                </section>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <a
                  href="/template-soal.docx"
                  download
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </a>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowImportModal(false)} disabled={importing}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (importNeedsSection && !importSectionId) { toast.error('Pilih section tujuan terlebih dahulu'); return }
                      docxRef.current?.click()
                    }}
                    loading={importing}
                    icon={!importing && <Upload className="w-4 h-4" />}
                  >
                    {importing ? 'Importing...' : 'Choose .docx file'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
