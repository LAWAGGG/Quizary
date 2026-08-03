import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Download, ClipboardList } from 'lucide-react'
import api from '../../api/client'
import { Card, Button, StatusBadge, Select, PageHeader, FormSubNav, EmptyState, CardSkeleton } from '../../components/ui'

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'auto_submitted', label: 'Auto Submitted' },
]

const sortOptions = [
  { value: '', label: 'Newest' },
  { value: 'score_desc', label: 'Highest score' },
  { value: 'score_asc', label: 'Lowest score' },
]

export default function Results() {
  const { formId } = useParams()
  const [data, setData] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 20 })
  const [formTitle, setFormTitle] = useState('')
  const [isQuiz, setIsQuiz] = useState(true)
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 20 }
      if (status) params.status = status
      if (sort) params.sort = sort
      const res = await api.get(`/forms/${formId}/results`, { params })
      setData(res.data.data)
      setMeta(res.data.meta)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [formId, status, sort, page])

  useEffect(() => {
    api.get(`/forms/${formId}`).then((res) => {
      setFormTitle(res.data.title)
      setIsQuiz(res.data.type === 'quiz')
    }).catch(() => {})
  }, [formId])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const handleExport = async (type) => {
    try {
      const res = await api.get(`/forms/${formId}/export/${type}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `results-${formId}.${type === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    }
  }

  const totalPages = Math.ceil(meta.total / meta.per_page)

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <div>
      <PageHeader
        eyebrow="Responses"
        title={formTitle || 'Results'}
        description={`${meta.total} submission${meta.total !== 1 ? 's' : ''}`}
        actions={
          <>
            <Link to={`/forms/${formId}/analytics`}>
              <Button variant="secondary" icon={<BarChart3 className="w-4 h-4" />}>Analytics</Button>
            </Link>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={() => handleExport('excel')}>Excel</Button>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={() => handleExport('pdf')}>PDF</Button>
          </>
        }
      />

      <FormSubNav formId={formId} className="mt-5" />

      <div className="flex flex-wrap gap-3 mt-6 mb-6">
        <div className="w-full sm:w-48">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status">
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        {isQuiz && (
          <div className="w-full sm:w-48">
            <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} aria-label="Sort results">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="w-6 h-6" />}
            title="No submissions yet"
            description="Share your form link to start receiving responses."
          />
        </Card>
      ) : (
        <>
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="hidden md:block">
            <Card className="overflow-hidden" padding={false}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Respondent</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{isQuiz ? 'Score / Max' : 'Answers'}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <motion.tr key={row.submission_id} variants={itemVariants} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-400">#{row.submission_id}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-ink">{row.respondent_name || 'Anonymous'}</td>
                      <td className="px-5 py-3.5 text-sm tabular-nums">
                        {isQuiz ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center justify-center min-w-[44px] h-7 px-2 rounded-lg font-semibold ${
                              row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.7
                                ? 'bg-correct-soft text-correct'
                                : row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.4
                                  ? 'bg-warn-soft text-warn'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {row.score ?? '-'}
                            </span>
                            <span className="text-gray-400">/ {row.max_score ?? '-'}</span>
                          </span>
                        ) : (
                          <span className="text-gray-600 block max-w-[320px] truncate">{row.answer_summary || '-'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{row.submitted_at || '-'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="md:hidden space-y-3">
            {data.map((row) => (
              <motion.div key={row.submission_id} variants={itemVariants}>
                <Card>
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-ink truncate block">{row.respondent_name || 'Anonymous'}</span>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">#{row.submission_id}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    {isQuiz ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-flex items-center justify-center h-6 px-2 rounded-lg text-xs font-semibold ${
                          row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.7
                            ? 'bg-correct-soft text-correct'
                            : row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.4
                              ? 'bg-warn-soft text-warn'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {row.score ?? '-'}
                        </span>
                        <span className="text-gray-400 text-xs">/ {row.max_score ?? '-'}</span>
                      </span>
                    ) : (
                      <span className="truncate pr-2">{row.answer_summary || '-'}</span>
                    )}
                    <span className="text-xs shrink-0">{row.submitted_at || '-'}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-gray-500 px-2">
                Page {page} of {totalPages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
