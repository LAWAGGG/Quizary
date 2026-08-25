import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, ClipboardList, Search } from 'lucide-react'
import api from '../../api/client'
import { Button, Input, StatusBadge, TypeBadge, Card, PageHeader, EmptyState, CardSkeleton, SpotlightCard } from '../../components/ui'

const TABS = ['All', 'Draft', 'Published', 'Closed']

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
                  <Card className="cursor-pointer hover:border-primary/40 hover:shadow-lift transition-all h-full flex flex-col relative overflow-hidden group">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-400 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-chip ${
                        form.type === 'quiz' ? 'bg-primary-50 text-primary' : 'bg-blue-50 text-blue-700'
                      }`}>
                        <ClipboardList className="w-5 h-5" />
                      </span>
                      
                    </div>
                    <h3 className="font-display font-semibold text-ink dark:text-gray-100 truncate mb-2">{form.title}</h3>
                    {form.description && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 line-clamp-2 mb-3 flex-1">{form.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={form.type} />
                      <StatusBadge status={form.status} />
                    </div>
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
