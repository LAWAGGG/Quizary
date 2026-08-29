import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, GripVertical, Upload, ArrowLeft, Check, HelpCircle, Trash2, Image as ImageIcon, X, Layers, Download, TextQuote, Unlink, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { useHoldSelect } from '../../hooks/useHoldSelect'
import { isAudioUrl } from '../../lib/media'
import { Button, Input, Select, Toggle, Card, Badge, ConfirmModal, PageHeader, FormSubNav, EmptyState, CardSkeleton, RichTextEditor, RichText } from '../../components/ui'
import SectionManager from '../../components/ui/SectionManager'

const TYPE_LABELS = {
  multiple_choice: 'Multiple Choice',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
  short_answer: 'Short Answer',
  essay: 'Essay',
  password: 'Password',
  date: 'Date',
  time: 'Time',
  file_upload: 'File Upload',
}

const TYPE_OPTIONS = ['multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'file_upload']
const OPTION_TYPES = ['multiple_choice', 'checkbox', 'dropdown']
const NO_GRADE_TYPES = ['essay', 'date', 'time', 'file_upload']

const TYPE_HINTS = {
  dropdown: 'Respondent selects one answer from a dropdown list.',
  date: 'Respondent selects a date (YYYY-MM-DD).',
  time: 'Respondent selects a time (HH:MM).',
  file_upload: 'Respondent uploads a file (pdf, doc, xls, ppt, txt, csv, image, zip).',
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function QuestionForm({ initial, onSave, onCancel, loading, isQuiz, errors, questionId, sections, sectionsAllowed, scoringMode }) {
  const toast = useToast()
  // Satu-satunya section = default tujuan soal baru; select section tak perlu tampil.
  const singleSectionId = sectionsAllowed && sections?.length === 1 ? sections[0].id : null
  const [form, setForm] = useState({
    question_text: '',
    type: 'essay',
    points: 1,
    is_scored: true,
    is_required: true,
    options: [],
    password_keyword: '',
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
      points: NO_GRADE_TYPES.includes(type) ? 0 : prev.points,
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
  const isPassword = form.type === 'password'
  const canSave = !!textOnly(form.question_text) && (!isPassword || !!form.password_keyword?.trim())
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

         {isPassword && (
        <div>
          <label className="field-label">Password Key</label>
          <input
            value={form.password_keyword || ''}
            onChange={(e) => setForm((p) => ({ ...p, password_keyword: e.target.value }))}
            placeholder="e.g. Rahasia2026"
            className={`input-field font-mono ${ferr('password_keyword') ? 'border-incorrect focus:border-incorrect' : ''}`}
            maxLength={255}
            spellCheck={false}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Answer must match exactly to proceed to the next section.</p>
          {ferr('password_keyword') && <p className="field-error">{ferr('password_keyword')}</p>}
        </div>
      )}

      {sectionsAllowed && sections?.length > 1 && (
        <div>
          <label className="field-label">Section</label>
          <Select
            value={form.section_id || ''}
            onChange={(e) => setForm((p) => ({ ...p, section_id: e.target.value ? parseInt(e.target.value) : null }))}
          >
            <option value="">— No section —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
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
          title={questionId ? 'Upload image or audio (mp3)' : 'Save question first to add media'}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary transition-colors"
        >
          {qImgLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          {qImgLoading ? 'Uploading...' : form.image ? 'Replace' : 'Add media'}
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
                disabled={!form.is_scored || scoringMode === 'auto'}
                error={ferr('points')}
              />
            ) : (
              <div>
                <label className="field-label">Points</label>
                <p className="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-ink-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 h-11 flex items-center">
                  {scoringMode === 'auto' ? `${form.points} pts (auto)` : 'Auto-assigned by system'}
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
                    aria-label={opt.is_correct ? 'Remove correct answer mark' : 'Mark as correct answer'}
                    title={opt.is_correct ? 'Remove correct answer mark' : 'Mark as correct answer'}
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
                    aria-label={opt.is_correct ? 'Remove correct answer mark' : 'Mark as correct answer'}
                    title={opt.is_correct ? 'Remove correct answer mark' : 'Mark as correct answer'}
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

function QuestionCard({ question, index, onDelete, isDragging, isQuiz, selected, onToggleSelect, groupId, groupIndex, groupSize, moveButtons }) {
  return (
    <Card className={`transition-all ${isDragging ? 'shadow-lift border-primary/40 opacity-60' : selected ? '!border-primary ring-2 ring-primary/30 bg-primary-50/40 dark:bg-primary-900/15' : 'hover:border-gray-300 dark:hover:border-gray-700'} ${groupId ? 'border-l-4 !border-l-primary/50' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile: checkbox tersembunyi → bubble nomor jadi indikator seleksi */}
          <span
            className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary' : 'bg-ink dark:bg-ink-800'}`}
            aria-hidden={selected}
          >
            {selected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : index + 1}
          </span>
          <Badge scheme="gray">{TYPE_LABELS[question.type]}</Badge>
          {groupId && (
            <Badge scheme="primary" title="Story group questions always appear in sequence even with shuffle active. Select question(s) then click Ungroup to remove.">
              <span className="hidden sm:inline">Group {groupIndex}</span>
              <span className="sm:hidden">G{groupIndex}</span>
            </Badge>
          )}
        </div>
        <div className="flex gap-1 shrink-0 items-center">
          {moveButtons}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(question) }}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-incorrect px-2 py-1 transition-colors"
            title="Delete question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(question.id)}
            onClick={(e) => e.stopPropagation()}
            className="hidden md:block w-4 h-4 rounded accent-primary cursor-pointer"
            aria-label={`Select question ${index + 1}`}
          />
        </div>
      </div>

      <div className="mb-3 flex items-start gap-1">
        <RichText html={question.question_text} className="rich-text block text-[15px] font-medium text-ink dark:text-gray-100" />
        {question.is_required !== false && (
          <span className="text-incorrect text-lg font-bold leading-none mt-0.5 shrink-0" title="Required">*</span>
        )}
      </div>
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
      {isQuiz && !NO_GRADE_TYPES.includes(question.type) && (question.is_scored ? question.points > 0 : true) && (
        <div className="flex justify-end mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {question.is_scored ? `${question.points} pts` : 'Not scored'}
          </span>
        </div>
      )}
    </Card>
  )
}

function SortableQuestionCard({ question, index, onEdit, onDelete, isQuiz, selected, onToggleSelect, groupId, groupIndex, groupSize, onMove, isFirst, isLast, selectCount }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useSortable({
    id: question.id,
    data: { type: 'question', questionId: question.id },
  })
  // ponytail: dnd-kit transform hanya aktif saat drag. Untuk mobile reorder
  // (tombol ↑↓), kita bypass dnd-kit transform → framer-motion `layout` yang
  // handle animasi position change. Tidak ada measurement loop karena tidak ada
  // drag aktif.
  const style = isDragging
    ? { transform: CSS.Transform.toString(transform), transition: 'none' }
    : undefined // framer layout handles non-drag reorder
  // Mobile: tahan kartu untuk memilih (haptic); saat mode seleksi aktif, tap = toggle.
  const holdProps = useHoldSelect({
    selectedCount: selectCount,
    onToggle: () => onToggleSelect(question.id),
  })
  // ponytail: `layout` hanya aktif saat TIDAK drag → framer animasi position
  // change untuk mobile reorder. Saat drag, style dari dnd-kit yang handle.
  return (
    <motion.div
      layout={!isDragging}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...holdProps}
        className="relative select-none cursor-pointer"
        onClick={(e) => {
          if (isDragging) return
          if (selectCount > 0) {
            holdProps.onClick()
            return
          }
          onEdit(question)
        }}
      >
        <span
          {...listeners}
          ref={setActivatorNodeRef}
          className="absolute left-0 top-3 bottom-3 w-6 hidden md:flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </span>
        <div className="md:pl-7">
          <QuestionCard
            question={question}
            index={index}
            onDelete={onDelete}
            isDragging={isDragging}
            isQuiz={isQuiz}
            selected={selected}
            onToggleSelect={onToggleSelect}
            groupId={groupId}
            groupIndex={groupIndex}
            groupSize={groupSize}
            moveButtons={onMove ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onMove(index, -1) }}
                  disabled={isFirst}
                  aria-label="Move question up"
                  className="w-7 h-7 rounded-lg bg-white dark:bg-ink-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all md:hidden"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMove(index, 1) }}
                  disabled={isLast}
                  aria-label="Move question down"
                  className="w-7 h-7 rounded-lg bg-white dark:bg-ink-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all md:hidden"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </>
            ) : null}
          />
        </div>
      </div>
    </motion.div>
  )
}

function QuestionItem({ q, index, onEdit, onDelete, isQuiz, selected, onToggleSelect, editOpen, onSave, onCancel, saveLoading, errors, sections, sectionsAllowed, groupId, groupIndex, groupSize, onMove, totalCount, selectCount, scoringMode }) {
  if (editOpen) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="md:pl-7">
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
              password_keyword: q.password_keyword || '',
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
            scoringMode={scoringMode}
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
        onDelete={onDelete}
        isQuiz={isQuiz}
        selected={selected}
        onToggleSelect={onToggleSelect}
        groupId={groupId}
        groupIndex={groupIndex}
        groupSize={groupSize}
        onMove={onMove}
        isFirst={index === 0}
        isLast={index === totalCount - 1}
        selectCount={selectCount}
      />
    )
}

function SectionHeader({ section, count, editing, draft, setDraft, onEdit, onSave, onCancel, onDelete, collapsible, collapsed, onToggle }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 border-b border-gray-200 dark:border-gray-800 pb-2.5">
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
            className="input-field h-9 text-sm flex-1"
            autoFocus
            placeholder="Section name"
          />
          <Button size="sm" onClick={onSave} icon={<Check className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} icon={<X className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">Cancel</span>
          </Button>
        </>
      ) : (
        <>
          {collapsible && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              title={collapsed ? 'Show questions' : 'Hide questions'}
              className="p-1 -ml-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors shrink-0"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          )}
          <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
          <h3 className="font-display font-semibold text-ink dark:text-gray-100 flex-1 truncate text-sm sm:text-base">
            {section ? section.title : 'General'}
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline">{count} question(s)</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 sm:hidden">{count}Q</span>
          {section && (
            <>
              <button onClick={onEdit} title="Rename section" className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-primary p-1.5 transition-colors shrink-0">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} title="Delete section" className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-incorrect p-1.5 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SectionDropZone({ sectionId, children }) {
  // ponytail: tidak lagi droppable — pindah section lewat dropdown di edit soal.
  // Drag kini murni untuk reorder; drop target section menghilangkan sumber
  // loop pengukuran dnd-kit (setState di tengah drag).
  return <div className="rounded-xl -mx-3 px-3">{children}</div>
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
  const [deleteWarning, setDeleteWarning] = useState(null) // { activeCount, questionIds, isBulk, questionName, questionObj }
  const [fieldErrors, setFieldErrors] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [showSectionManager, setShowSectionManager] = useState(false)
  // Section yang dilipat (accordion) — biar gampang cari soal di form panjang.
  const [collapsedSections, setCollapsedSections] = useState(() => new Set())
  const toggleSectionCollapse = (id) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
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
  const scoringMode = form?.scoring_mode || 'auto'

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
      password_keyword: data.type === 'password' ? data.password_keyword : undefined,
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

  const confirmDeleteSingle = async (question) => {
    try {
      const { data } = await api.get(`/questions/${question.id}/active-count`)
      if (data.active_count > 0) {
        setDeleteWarning({ activeCount: data.active_count, questionIds: [question.id], isBulk: false, questionName: (question.question_text || '').replace(/<[^>]*>/g, '').slice(0, 50), questionObj: question })
      } else {
        setDeleteTarget(question)
      }
    } catch {
      setDeleteTarget(question)
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
  // Stable group index: order by first appearance in the question list
  const groupIndexMap = {}
  questions.forEach((q) => {
    if (q.group_id && !(q.group_id in groupIndexMap)) {
      groupIndexMap[q.group_id] = Object.keys(groupIndexMap).length + 1
    }
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
      toast.success(`${selectedIds.length} question(s) grouped into one story group`)
      setSelectedIds([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to group questions')
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
      toast.success(`${groupedQs.length} question(s) removed from group`)
      setSelectedIds([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove question(s) from group')
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
      await api.post(`/forms/${formId}/questions/bulk-delete`, { question_ids: selectedIds })
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

  const confirmBulkDelete = async () => {
    if (!selectedIds.length) return
    try {
      const { data } = await api.post(`/forms/${formId}/questions/bulk-active-count`, { question_ids: selectedIds })
      if (data.active_count > 0) {
        setDeleteWarning({ activeCount: data.active_count, questionIds: selectedIds, isBulk: true, questionName: null })
      } else {
        setShowBulkDelete(true)
      }
    } catch {
      setShowBulkDelete(true)
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

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveDrag(null)
    if (!over) return

    // Hanya reorder antar soal. Pindah section lewat dropdown di edit soal —
    // tidak ada setState di tengah drag = loop pengukuran dnd-kit mustahil.
    if (active.data.current?.type !== 'question' || over.data.current?.type !== 'question') return
    const from = questions.findIndex((q) => q.id === active.id)
    const to = questions.findIndex((q) => q.id === over.id)
    if (from === -1 || to === -1 || from === to) return
    const next = arrayMove(questions, from, to)
    setQuestions(next)
    setReorderSaving(true)
    try {
      await api.patch('/questions/reorder', { form_id: parseInt(formId), orders: next.map((q) => q.id) })
    } catch {
      load(true)
    } finally {
      setReorderSaving(false)
    }
  }

  const handleDragCancel = () => setActiveDrag(null)

  // Pindah soal via tombol panah (andalan di mobile — drag sentuh sering bentrok scroll).
  const moveQuestion = async (index, dir) => {
    const to = index + dir
    if (to < 0 || to >= questions.length) return
    const next = arrayMove(questions, index, to)
    setQuestions(next)
    setReorderSaving(true)
    try {
      await api.patch('/questions/reorder', { form_id: parseInt(formId), orders: next.map((q) => q.id) })
    } catch {
      load(true)
    } finally {
      setReorderSaving(false)
    }
  }

  const handleDocxImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    // Section >1: tujuan import wajib dipilih (divalidasi juga di backend).
    if (importNeedsSection && !importSectionId) {
      toast.error('Select target section first')
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
      toast.success('Section added')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add section')
    } finally {
      setSectionSaving(false)
    }
  }

  const renameSection = async (section) => {
    if (!sectionTitleDraft.trim()) return
    try {
      await api.patch(`/sections/${section.id}`, { title: sectionTitleDraft.trim() })
      setEditingSectionId(null)
      toast.success('Section updated')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update section')
    }
  }

  const deleteSection = async () => {
    if (!sectionDeleteTarget) return
    setConfirmLoading(true)
    try {
      await api.delete(`/sections/${sectionDeleteTarget.id}`)
      setSectionDeleteTarget(null)
      toast.success('Section deleted')
      load()
    } catch {
      toast.error('Failed to delete section')
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
        title={<RichText html={form.title} />}
        description={`${questions.length} question${questions.length !== 1 ? 's' : ''}`}
        actions={
          <>
            <input ref={docxRef} type="file" accept=".docx" onChange={handleDocxImport} className="hidden" />
            <Button variant="secondary" onClick={() => { if (docxRef.current) docxRef.current.value = ''; setShowImportModal(true) }} icon={<Upload className="w-4 h-4" />}>
              <span className="hidden sm:inline">Import DOCX</span>
            </Button>
            {sectionsAllowed && (
              <Button variant="secondary" onClick={() => setShowSectionManager(true)} icon={<Layers className="w-4 h-4" />}>
                <span className="hidden sm:inline">Manage Sections</span>
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setShowForm(true); setFieldErrors({}) }} icon={<Plus className="w-4 h-4" />}>
              <span className="hidden sm:inline">Add Question</span>
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
            placeholder="Section name, e.g. Section A"
            autoFocus
          />
          <Button onClick={createSection} loading={sectionSaving} disabled={!newSectionTitle.trim()}>Add</Button>
          <Button variant="ghost" onClick={() => setNewSectionOpen(false)}>Cancel</Button>
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
                scoringMode={scoringMode}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state generik hanya kalau memang tidak ada section utk ditampilkan;
          kalau ada section, biarkan list tampil dengan hint "belum ada soal". */}
      {questions.length === 0 && !showForm && (!sectionsAllowed || sections.length === 0) ? (
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
              className="sticky top-0 z-20 mt-6 bg-white dark:bg-ink-900 border border-gray-200 dark:border-gray-700 shadow-lift rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3"
            >
              <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="hidden sm:inline">Select all ({selectedIds.length}/{questions.length})</span>
                <span className="sm:hidden">{selectedIds.length}/{questions.length}</span>
              </label>
              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="flex items-center gap-1.5 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
                  title="Cancel selection"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">Cancel</span>
                </button>
                {selectionGrouped ? (
                  <button
                    onClick={handleUngroupSelected}
                    disabled={ungrouping}
                    title="Remove from story group"
                    className="flex items-center gap-1.5 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-primary-soft transition-colors disabled:opacity-40"
                  >
                    {ungrouping ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Unlink className="w-4 h-4" />}
                    <span className="hidden sm:inline text-sm font-medium">Ungroup</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGroup}
                    disabled={!canGroup || grouping}
                    title={canGroup ? 'Group selected' : 'Select 2+ questions in same section'}
                    className="flex items-center gap-1.5 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-primary-soft transition-colors disabled:opacity-40"
                  >
                    {grouping ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <TextQuote className="w-4 h-4" />}
                    <span className="hidden sm:inline text-sm font-medium">Group</span>
                  </button>
                )}
                <button
                  onClick={confirmBulkDelete}
                  title={`Delete ${selectedIds.length} question(s)`}
                  className="flex items-center gap-1.5 p-2 rounded-lg text-incorrect hover:bg-incorrect-soft transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">Delete ({selectedIds.length})</span>
                </button>
              </div>
            </motion.div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-8 mt-6">
                {sectionsAllowed ? (
                  <>
                    {sections.map((sec) => {
                      const secQs = questions.filter((q) => q.section_id === sec.id)
                      const collapsed = collapsedSections.has(sec.id)
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
                            collapsible
                            collapsed={collapsed}
                            onToggle={() => toggleSectionCollapse(sec.id)}
                          />
                          {!collapsed && (secQs.length ? (
                            <div className="space-y-3 mt-3">
                              {secQs.map((q) => (
                                <QuestionItem
                                  key={q.id}
                                  q={q}
                                  index={questions.indexOf(q)}
                                  onEdit={editQuestion}
                                  onDelete={confirmDeleteSingle}
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
                                  groupIndex={q.group_id ? (groupIndexMap[q.group_id] || 0) : 0}
                                  groupSize={q.group_id ? (groupCounts[q.group_id] || 0) : 0}
                                  onMove={moveQuestion}
                                  totalCount={questions.length}
                                  selectCount={selectedIds.length}
                                  scoringMode={scoringMode}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">
                              No questions yet in this section.
                            </p>
                          ))}
                        </SectionDropZone>
                      )
                    })}
                  </>
                ) : (
                  questions.map((q) => (
                               <QuestionItem
                                key={q.id}
                                q={q}
                                index={questions.indexOf(q)}
                                onEdit={editQuestion}
                                onDelete={confirmDeleteSingle}
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
                                  groupIndex={q.group_id ? (groupIndexMap[q.group_id] || 0) : 0}
                                  groupSize={q.group_id ? (groupCounts[q.group_id] || 0) : 0}
                                 onMove={moveQuestion}
                                 totalCount={questions.length}
                                 selectCount={selectedIds.length}
                                 scoringMode={scoringMode}
                               />
                   ))
                 )}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
              {activeDrag?.type === 'question' && (() => {
                const q = questions.find((qq) => qq.id === activeDrag.id)
                return q ? (
                  <motion.div
                    initial={{ scale: 1.02, opacity: 0.9 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card className="shadow-lift border-primary/40">
                      <div className="flex items-center gap-3">
                        <span className="text-primary"><GripVertical className="w-5 h-5" /></span>
                        <Badge scheme="gray">{TYPE_LABELS[q.type]}</Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[240px]">
                          {(q.question_text || '').replace(/<[^>]*>/g, '').trim()}
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                ) : null
              })()}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <ConfirmModal
        show={!!sectionDeleteTarget}
        title="Delete Section?"
        message={`Section "${sectionDeleteTarget?.title || ''}" will be deleted. Questions inside will remain, just unlinked from any section.`}
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
        show={!!deleteWarning}
        title="Ada submission aktif"
        message={
          <div>
            <p>
              {deleteWarning?.isBulk
                ? `${deleteWarning?.questionIds.length} soal ini masih punya ${deleteWarning?.activeCount} submission aktif.`
                : `Soal "${deleteWarning?.questionName}..." masih punya ${deleteWarning?.activeCount} submission aktif.`
              }
            </p>
            <p className="mt-2 text-sm">Menghapus soal ini akan membuat submission yang sedang berjalan kehilangan data ini. Tetap hapus?</p>
          </div>
        }
        onConfirm={() => {
          if (deleteWarning?.isBulk) {
            setShowBulkDelete(true)
          } else {
            setDeleteTarget(deleteWarning?.questionObj)
          }
          setDeleteWarning(null)
        }}
        onCancel={() => setDeleteWarning(null)}
        confirmText="Tetap Hapus"
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
              className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-2xl max-h-[85dvh] flex flex-col shadow-lift"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-ink dark:text-gray-100">Import from Word</h3>
                    <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">Follow the format below</p>
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

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
                {importNeedsSection && (
                  <section>
                    <label className="field-label">Target section *</label>
                    <Select
                      value={importSectionId}
                      onChange={(e) => setImportSectionId(e.target.value)}
                    >
                      <option value="">— Select section —</option>
                      {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </Select>
                  </section>
                )}

                {/* Format rules */}
                <section>
                  <h4 className="text-xs sm:text-sm font-semibold text-ink dark:text-gray-100 mb-2">Format rules</h4>
                  <ul className="space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-correct shrink-0 mt-0.5" /><span>Start each question with a number, e.g. <strong>1.</strong> or <strong>1)</strong></span></li>
                    <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-correct shrink-0 mt-0.5" /><span>List choices with letters: <strong>A.</strong>, <strong>B.</strong>, etc.</span></li>
                    <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-correct shrink-0 mt-0.5" /><span>Mark correct answer with <strong>Answer: B</strong></span></li>
                    <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-correct shrink-0 mt-0.5" /><span>Multiple correct = checkbox. No choices = essay.</span></li>
                  </ul>
                </section>

                {/* Example */}
                <section>
                  <h4 className="text-xs sm:text-sm font-semibold text-ink dark:text-gray-100 mb-2">Example</h4>
                  <div className="rounded-xl bg-gray-50 dark:bg-ink-800/60 border border-gray-200 dark:border-gray-700 p-3 sm:p-4 font-mono text-[11px] sm:text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 overflow-auto max-h-48 whitespace-pre">{`1. What is the capital of France?
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

3. Explain how photosynthesis works.`}</div>
                </section>

                {/* Notes */}
                <section>
                  <h4 className="text-xs sm:text-sm font-semibold text-ink dark:text-gray-100 mb-2">Notes</h4>
                  <ul className="space-y-1 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 list-disc pl-4">
                    <li>Only .docx files are accepted.</li>
                    <li>Imported questions are appended at the end.</li>
                    <li>For quizzes, points are redistributed automatically.</li>
                  </ul>
                </section>
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 gap-2">
                <a
                  href="/template-soal.docx"
                  download
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary hover:text-primary-700 dark:hover:text-primary-300 transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Download Template</span>
                  <span className="sm:hidden">Template</span>
                </a>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowImportModal(false)} disabled={importing} size="sm">Cancel</Button>
                  <Button
                    onClick={() => {
                      if (importNeedsSection && !importSectionId) { toast.error('Select target section first'); return }
                      docxRef.current?.click()
                    }}
                    loading={importing}
                    icon={!importing && <Upload className="w-4 h-4" />}
                    size="sm"
                  >
                    {importing ? 'Importing...' : 'Choose file'}
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
