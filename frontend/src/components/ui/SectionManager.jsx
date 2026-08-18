import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, X, Plus, Check } from 'lucide-react'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable, closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Button, Badge, ConfirmModal } from '../../components/ui'

const QUESTION_PREFIX = 'q-'

function SortableSectionCard({ section, questions, onDelete, editing, editDraft, setEditDraft, onEditStart, onEditSave, onEditCancel, onUnassign }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: 'section' },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const secQs = questions.filter((q) => q.section_id === section.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border transition-all ${isDragging ? 'opacity-40 border-primary' : 'border-gray-200 dark:border-gray-700'}`}
    >
      <div className="flex items-center gap-3 px-4 py-3 cursor-default">
        <span
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing"
          title="Seret untuk mengubah urutan section"
        >
          <GripVertical className="w-5 h-5" />
        </span>
        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
        {editing ? (
          <>
            <input
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
              className="input-field h-8 text-sm flex-1"
              autoFocus
            />
            <Button size="sm" onClick={onEditSave} icon={<Check className="w-3.5 h-3.5" />}>Simpan</Button>
            <Button size="sm" variant="ghost" onClick={onEditCancel}>Batal</Button>
          </>
        ) : (
          <>
            <span className="font-display font-semibold text-ink dark:text-gray-100 flex-1 truncate">{section.title}</span>
            <Badge scheme="gray">{secQs.length} soal</Badge>
            <button onClick={onEditStart} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-primary px-2 py-1 transition-colors">Rename</button>
            <button onClick={onDelete} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-incorrect px-2 py-1 transition-colors">Delete</button>
          </>
        )}
      </div>

      {isDragging ? (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center italic">
          Melepas soal… seret untuk memindahkan
        </div>
      ) : secQs.length > 0 ? (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2 space-y-1.5">
          {secQs.map((q) => (
            <DraggableQuestion key={q.id} q={q} onUnassign={onUnassign} />
          ))}
        </div>
      ) : (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center italic">
          Drop questions here
        </div>
      )}
    </div>
  )
}

function DraggableQuestion({ q, onUnassign }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${QUESTION_PREFIX}${q.id}`,
    data: { type: 'question', questionId: q.id },
  })
  return (
    <div
      ref={setNodeRef}
      className={`group flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-ink-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors ${isDragging ? 'opacity-40' : ''}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing inline-flex shrink-0">
        <GripVertical className="w-3.5 h-3.5 opacity-50" />
      </span>
      <span className="truncate flex-1">{(q.question_text || '').replace(/<[^>]*>/g, '').slice(0, 60)}</span>
      <Badge scheme="gray" className="text-[10px] shrink-0">{q.type.replace('_', ' ')}</Badge>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onUnassign(q.id) }}
        title="Keluarkan dari section"
        aria-label={`Keluarkan soal ${q.id} dari section`}
        className="shrink-0 p-1 rounded-md text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-incorrect hover:bg-incorrect-soft transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function UnassignedPool({ questions, isOver, dropProps }) {
  const unassigned = questions.filter((q) => !q.section_id)

  return (
    <div
      ref={dropProps.setNodeRef}
      className={`space-y-2 rounded-xl p-2 transition-all ${isOver ? 'border border-primary bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Unassigned</span>
        <Badge scheme="gray">{unassigned.length}</Badge>
      </div>
      {unassigned.length > 0 ? (
        <div className="space-y-1.5">
          {unassigned.map((q) => (
            <DraggableQuestion key={q.id} q={q} onUnassign={() => {}} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-3 text-xs text-gray-400 dark:text-gray-500 text-center italic">
          Drop questions here to remove from section
        </div>
      )}
    </div>
  )
}

export default function SectionManager({ formId, show, onClose, sections: initialSections, questions: initialQuestions, onSaved }) {
  const toast = useToast()
  const [sections, setSections] = useState(initialSections || [])
  const [questions, setQuestions] = useState(initialQuestions || [])
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [sectionReordering, setSectionReordering] = useState(false)
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [activeDrag, setActiveDrag] = useState(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (show) {
      setSections(initialSections || [])
      setQuestions(initialQuestions || [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const load = () => {
    Promise.all([
      api.get(`/forms/${formId}/sections`),
      api.get(`/forms/${formId}/questions`),
    ]).then(([sRes, qRes]) => {
      setSections(sRes.data.data)
      setQuestions(qRes.data.data)
    }).catch(() => {})
  }

  const moveQuestionToSection = async (qId, targetSectionId) => {
    const q = questions.find((qq) => qq.id === qId)
    if (!q) return

    const newSectionId = targetSectionId === 'unassigned' ? null : targetSectionId
    if (newSectionId !== null && !sections.some((s) => s.id === newSectionId)) return
    if (q.section_id === newSectionId) return

    setQuestions((prev) =>
      prev.map((qq) => qq.id === qId ? { ...qq, section_id: newSectionId } : qq)
    )

    try {
      await api.put(`/questions/${qId}`, { section_id: newSectionId })
      toast.success('Question moved')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal move question')
      load()
    }
  }

  const handleDragStart = (event) => {
    setActiveDrag({ type: event.active.data.current?.type, id: event.active.id })
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return
    if (active.data.current?.type !== 'section') return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      setSections((prev) => arrayMove(prev, oldIndex, newIndex))
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveDrag(null)
    if (!over) return

    const type = active.data.current?.type

    if (type === 'question') {
      const qId = Number(active.data.current.questionId)
      if (over.id === 'unassigned') {
        await moveQuestionToSection(qId, 'unassigned')
      } else if (typeof over.id === 'number') {
        await moveQuestionToSection(qId, over.id)
      }
      return
    }

    if (type === 'section' && typeof over.id === 'number') {
      setSectionReordering(true)
      try {
        await api.patch('/sections/reorder', { form_id: parseInt(formId), orders: sections.map((s) => s.id) })
        onSaved()
      } catch {
        toast.error('Gagal menyimpan urutan section')
        load()
      } finally {
        setSectionReordering(false)
      }
    }
  }

  const renameSection = async (section) => {
    if (!editDraft.trim()) return
    try {
      await api.patch(`/sections/${section.id}`, { title: editDraft.trim() })
      setEditingId(null)
      toast.success('Section renamed')
      load()
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal rename section')
    }
  }

  const deleteSection = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/sections/${deleteTarget.id}`)
      setDeleteTarget(null)
      toast.success('Section deleted')
      load()
      onSaved()
    } catch {
      toast.error('Gagal hapus section')
      setDeleteTarget(null)
    }
  }

  const createSection = async () => {
    if (!newSectionTitle.trim()) return
    setCreatingSection(true)
    try {
      await api.post(`/forms/${formId}/sections`, { title: newSectionTitle.trim() })
      setNewSectionTitle('')
      setNewSectionOpen(false)
      toast.success('Section ditambahkan')
      load()
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menambah section')
    } finally {
      setCreatingSection(false)
    }
  }

  const unassignedDrop = useDroppable({
    id: 'unassigned',
    data: { type: 'unassigned' },
  })

  const activeQuestion = activeDrag?.type === 'question'
    ? questions.find((q) => q.id === Number(activeDrag.id?.toString().replace(QUESTION_PREFIX, '')))
    : null
  const activeSection = activeDrag?.type === 'section'
    ? sections.find((s) => s.id === Number(activeDrag.id))
    : null

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-ink-900 flex flex-col shadow-lift"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div>
                <h2 className="font-display text-lg font-bold text-ink dark:text-gray-100">Manage Sections</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Seret section untuk urutkan · Seret soal untuk pindahkan</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDrag(null)}
            >
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
                {sectionReordering && (
                  <div className="text-xs text-primary font-medium flex items-center gap-1.5 mb-2">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving section order...
                  </div>
                )}

                {sections.length === 0 && !newSectionOpen && (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    No sections yet. Add one to organize your questions.
                  </div>
                )}

                <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {sections.map((section) => (
                    <SortableSectionCard
                      key={section.id}
                      section={section}
                      questions={questions}
                      editing={editingId === section.id}
                      editDraft={editDraft}
                      setEditDraft={setEditDraft}
                      onEditStart={() => { setEditingId(section.id); setEditDraft(section.title) }}
                      onEditSave={() => renameSection(section)}
                      onEditCancel={() => setEditingId(null)}
                      onDelete={() => setDeleteTarget(section)}
                      onUnassign={(qId) => moveQuestionToSection(qId, 'unassigned')}
                    />
                  ))}
                </SortableContext>

                {newSectionOpen ? (
                  <div className="flex gap-2 items-center">
                    <input
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createSection() }}
                      className="input-field h-9 text-sm flex-1"
                      placeholder="Nama section"
                      autoFocus
                    />
                    <Button size="sm" onClick={createSection} loading={creatingSection} disabled={!newSectionTitle.trim()}>Tambah</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setNewSectionOpen(false); setNewSectionTitle('') }}>Batal</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewSectionOpen(true)}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-400 dark:text-gray-500 hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                )}

                <UnassignedPool
                  questions={questions}
                  isOver={unassignedDrop.isOver}
                  dropProps={unassignedDrop}
                />
              </div>

              <DragOverlay dropAnimation={null} className="origin-top-left">
                {activeQuestion && (
                  <div className="bg-white dark:bg-ink-900 border border-primary/40 rounded-lg shadow-lift px-3 py-2 h-10 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 opacity-50" />
                    <span className="truncate max-w-[280px]">{(activeQuestion.question_text || '').replace(/<[^>]*>/g, '').slice(0, 60)}</span>
                  </div>
                )}
                {activeSection && (
                  <div className="bg-white dark:bg-ink-900 border border-primary/40 rounded-xl shadow-lift px-4 w-[280px] h-11 flex items-center font-display font-semibold text-ink dark:text-gray-100">
                    <span className="truncate">{activeSection.title}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            <ConfirmModal
              show={!!deleteTarget}
              title="Hapus Section?"
              message={`Section "${deleteTarget?.title || ''}" akan dihapus. Soal di dalamnya tetap ada, hanya lepas dari section.`}
              onConfirm={deleteSection}
              onCancel={() => setDeleteTarget(null)}
              confirmText="Delete"
              variant="danger"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
