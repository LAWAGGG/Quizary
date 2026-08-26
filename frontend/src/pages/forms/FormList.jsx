import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, ClipboardList, Search, Trophy, HelpCircle } from 'lucide-react'
import api from '../../api/client'
import { Button, Input, Card, PageHeader, EmptyState, CardSkeleton, SpotlightCard, RichText } from '../../components/ui'

const TABS = ['All', 'Draft', 'Published', 'Closed']

const STATUS_DOT = {
  published: 'bg-correct',
  draft: 'bg-gray-400',
  closed: 'bg-incorrect',
}

// Warna tema form → CSS vars: --tb (base), --tbb (border light), --tbbd
// (border dark — alpha lebih tinggi agar tetap terlihat di latar gelap),
// --ts (soft/wash). Tanpa tema → fallback palet primary aplikasi.
function themeVars(color) {
  if (!color) {
    // Ungu default (primary-400-ish) — hover tetap ungu cerah, bukan gelap.
    return {
      '--tb': '#8B7CF6',
      '--tbb': 'rgba(139,124,246,0.45)',
      '--tbbd': 'rgba(139,124,246,0.55)',
      '--ts': 'rgba(139,124,246,0.14)',
    }
  }
  return { '--tb': color, '--tbb': `${color}59`, '--tbbd': `${color}b3`, '--ts': `${color}24` }
}

function FormTypeCluster({ form }) {
  const isQuiz = form.type === 'quiz'
  return (
    <div className="absolute bottom-3 right-3 z-10 flex -space-x-2">
      <span
        className="relative z-30 w-9 h-9 rounded-xl border-2 flex items-center justify-center shadow-chip transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:-rotate-6"
        style={{ backgroundColor: 'var(--ts)', color: 'var(--tb)', borderColor: 'var(--ts)' }}
        title={isQuiz ? 'Quiz' : 'Form'}
      >
        {isQuiz ? <Trophy className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
      </span>
      <span
        className="relative z-20 h-9 px-2.5 rounded-xl border-2 flex items-center gap-1 text-xs font-bold tabular-nums shadow-chip bg-white dark:bg-ink-800 text-gray-600 dark:text-gray-300 transition-all duration-200 ease-in-out group-hover:-translate-y-2 delay-[40ms]"
        style={{ borderColor: 'var(--ts)' }}
        title={`${form.question_count} soal`}
      >
        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
        {form.question_count}
      </span>
      <span className="relative z-10 w-9 h-9 rounded-xl border-2 flex items-center justify-center bg-white dark:bg-ink-800 shadow-chip transition-all duration-200 ease-in-out group-hover:-translate-y-3 delay-[80ms]" style={{ borderColor: 'var(--ts)' }} title={form.status}>
        <span className={`w-3 h-3 rounded-full ${STATUS_DOT[form.status] || 'bg-gray-400'}`} />
      </span>
    </div>
  )
}

// Area visual atas kartu: banner asli bila ada, fallback gradasi tema + ikon
// type besar samar (bukan mock palsu — tetap jujur merepresentasikan form).
function FormVisual({ form }) {
  if (form.banner_path) {
    return (
      <img
        src={form.banner_path}
        alt=""
        className="relative w-full h-32 max-h-32 object-cover rounded-xl border-2 border-[var(--tbb)] dark:border-[var(--tbbd)] mb-3"
        loading="lazy"
      />
    )
  }
  return (
    <div
      className="relative h-44 w-full rounded-xl border-2 border-[var(--tbb)] dark:border-[var(--tbbd)] mb-3 overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(180deg, var(--ts) 0%, transparent 70%)' }}
    >
      {form.type === 'quiz'
        ? <Trophy className="w-12 h-12 opacity-15" style={{ color: 'var(--tb)' }} />
        : <ClipboardList className="w-12 h-12 opacity-15" style={{ color: 'var(--tb)' }} />}
    </div>
  )
}

export default function FormList() {
  const navigate = useNavigate()
  const [forms, setForms] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 20 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    const status = activeTab === 'All' ? undefined : activeTab.toLowerCase()
    api.get('/forms', { params: { page: meta.page, per_page: meta.per_page, status } })
      .then((res) => { setForms(res.data.data); setMeta(res.data.meta) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeTab, meta.page, meta.per_page])

  const filtered = useMemo(() => {
    if (!search.trim()) return forms
    return forms.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
  }, [forms, search])

  const totalPages = Math.ceil(meta.total / meta.per_page)

  return (
    <div>
      <PageHeader
        eyebrow="Your forms"
        title="Forms"
        description="Create, manage, and share your forms and quizzes."
        actions={
          <Button onClick={() => navigate('/forms/new')} icon={<Plus className="w-4 h-4" />}>
            Create New Form
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6 mb-6">
        <div className="relative w-full sm:max-w-xs">
          <Input
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search forms"
          />
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-ink rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setMeta((m) => ({ ...m, page: 1 })) }}
              className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white dark:bg-ink-800 shadow-chip text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-ink dark:hover:text-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="w-6 h-6" />}
            title={search.trim() ? 'No matching forms' : 'No forms yet'}
            description={search.trim() ? 'Try a different search or filter.' : 'Create a form or quiz and share it with anyone.'}
            action={
              !search.trim() && (
                <Button onClick={() => navigate('/forms/new')} icon={<Plus className="w-4 h-4" />}>
                  Create New Form
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((form, i) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/forms/${form.id}`)}
                className="h-full"
              >
                <SpotlightCard className="h-full" intensity={0.1}>
                  <Card
                    className="cursor-pointer transition-all duration-300 ease-in-out h-full flex flex-col relative overflow-hidden group border-2 border-[var(--tbb)] dark:border-[var(--tbbd)] hover:border-[var(--tb)] hover:shadow-[0_14px_36px_-14px_var(--tb)]"
                    style={themeVars(form.theme_color)}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-55 group-hover:opacity-95"
                      style={{ background: 'radial-gradient(130% 100% at 100% 100%, var(--ts) 0%, transparent 75%)' }}
                      aria-hidden="true"
                    />
                    <FormVisual form={form} />
                    <h1 className="relative text-xl font-display font-semibold text-ink dark:text-gray-100 mb-1 truncate"><RichText html={form.title} /></h1>
                    {form.description && (
                      <RichText html={form.description} className="rich-text relative block text-sm text-gray-400 dark:text-gray-500 line-clamp-2 mb-3 flex-1 pr-16" />
                    )}
                    {/* ruang untuk klaster pojok kanan-bawah */}
                    <div className="relative h-6" />
                    <FormTypeCluster form={form} />
                  </Card>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="ghost"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-gray-500 dark:text-gray-400 px-2">
                Page {meta.page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={meta.page >= totalPages}
                onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
