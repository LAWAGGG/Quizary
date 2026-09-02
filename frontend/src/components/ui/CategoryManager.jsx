import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Edit2, Check, Folder, Palette } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Button, Input } from './index'

const PRESETS = ['#6C5CE7', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4']

export function CategoryManager({ open, onClose, categories, onChanged }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESETS[0])
  const [editing, setEditing] = useState(null) // {id, name, color}
  const [saving, setSaving] = useState(false)

  const reset = () => { setName(''); setColor(PRESETS[0]); setEditing(null) }

  const handleCreate = async (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) { toast.error('Nama kategori tidak boleh kosong'); return }
    if (n.length > 50) { toast.error('Nama maksimal 50 karakter'); return }
    setSaving(true)
    try {
      if (editing) {
        const res = await api.put(`/categories/${editing.id}`, { name: n, color })
        toast.success('Kategori diperbarui')
        onChanged?.(res.data)
      } else {
        const res = await api.post('/categories', { name: n, color })
        toast.success('Kategori dibuat')
        onChanged?.(res.data)
      }
      reset()
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Gagal menyimpan kategori')
    } finally { setSaving(false) }
  }

  const handleEdit = (cat) => {
    setEditing(cat)
    setName(cat.name)
    setColor(cat.color || PRESETS[0])
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Hapus kategori "${cat.name}"? Form di dalamnya jadi Tanpa kategori.`)) return
    try {
      await api.delete(`/categories/${cat.id}`)
      toast.success('Kategori dihapus')
      onChanged?.(null, cat.id)
      if (editing?.id === cat.id) reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus')
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 8 }}
            className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-lg shadow-lift flex flex-col max-h-[86dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100 flex items-center gap-2">
                  <Folder className="w-5 h-5 text-primary" /> Kategori Form
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Kelompokkan form seperti folder — mis. Matematika, IPA, Survey.</p>
              </div>
              <button onClick={onClose} className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-ink hover:bg-gray-100 dark:hover:bg-ink-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Create / Edit form */}
              <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-ink-800/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> {editing ? 'Edit kategori' : 'Buat kategori baru'}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama kategori, cth. Matematika"
                    maxLength={50}
                    className="flex-1"
                  />
                  <Button type="submit" loading={saving} icon={editing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
                    {editing ? 'Simpan' : 'Tambah'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-ink dark:border-white scale-110 shadow-chip' : 'border-white dark:border-ink-700'}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 overflow-hidden"
                    title="Pilih warna custom"
                  />
                  {editing && (
                    <button type="button" onClick={reset} className="ml-auto text-xs font-medium text-gray-500 hover:text-ink">
                      Batal edit
                    </button>
                  )}
                </div>
              </form>

              {/* List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Daftar kategori · {categories.length}
                </p>
                {categories.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-8 text-center">
                    <Folder className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">Belum ada kategori</p>
                    <p className="text-xs text-gray-400 mt-1">Buat kategori dulu agar form bisa dikelompokkan.</p>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-800 px-4 py-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6C5CE7' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-gray-100 truncate">{cat.name}</p>
                        <p className="text-xs text-gray-400 tabular-nums">{cat.form_count ?? 0} form</p>
                      </div>
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-900/20"
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="p-2 rounded-lg text-gray-400 hover:text-incorrect hover:bg-incorrect-soft"
                        aria-label={`Hapus ${cat.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <Button variant="secondary" className="w-full" onClick={onClose}>Selesai</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
