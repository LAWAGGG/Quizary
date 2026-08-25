import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Download, ClipboardList, X, Check } from 'lucide-react'
import api from '../../api/client'
import { Card, Button, StatusBadge, Select, PageHeader, FormSubNav, EmptyState, CardSkeleton, RichText, sanitizeHtml } from '../../components/ui'
import { isAudioUrl } from '../../lib/media'

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'auto_submitted', label: 'Auto Submitted' },
  { value: 'cheating', label: 'Cheating' },
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
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

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

  const handleExport = async () => {
    try {
      const res = await api.get(`/forms/${formId}/export/excel`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const safeTitle = (formTitle || 'form').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')
      const today = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeTitle}_${today}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    }
  }

  const openDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/submissions/${id}`)
      setDetail(res.data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
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
           
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleExport}>Excel</Button>
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
                  <tr className="border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-ink-800/50">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">ID</th>
                    {isQuiz && <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Rank</th>}
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Respondent</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{isQuiz ? 'Score / Max' : 'Answers'}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <motion.tr
                      key={row.submission_id}
                      variants={itemVariants}
                      className={`border-b border-gray-50 last:border-0 transition-colors cursor-pointer ${
                        row.status === 'cheating' ? 'bg-incorrect-soft hover:bg-incorrect-soft' : 'hover:bg-gray-50/70 dark:hover:bg-ink-800/50'
                      }`}
                      onClick={() => openDetail(row.submission_id)}
                    >
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-400 dark:text-gray-500">#{row.submission_id}</td>
                      {isQuiz && <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-gray-500 dark:text-gray-400">{row.rank ?? '-'}</td>}
                      <td className="px-5 py-3.5 text-sm font-medium text-ink dark:text-gray-100">{row.respondent_name || 'Anonymous'}{row.is_creator && <span className="text-primary text-xs font-semibold ml-1.5">(you)</span>}</td>
                      <td className="px-5 py-3.5 text-sm tabular-nums">
                        {isQuiz ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center justify-center min-w-[44px] h-7 px-2 rounded-lg font-semibold ${
                              row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.7
                                ? 'bg-correct-soft text-correct'
                                : row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.4
                                  ? 'bg-warn-soft text-warn'
                                  : 'bg-gray-100 dark:bg-ink-800 text-gray-600 dark:text-gray-400'
                            }`}>
                              {row.score ?? '-'}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500">/ {row.max_score ?? '-'}</span>
                          </span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 block max-w-[320px] truncate">{row.answer_summary || '-'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={row.status} />{row.cheat_reason && (
                        <p className="text-[11px] text-incorrect/80 mt-1 max-w-[180px] truncate" title={row.cheat_reason}>{row.cheat_reason}</p>
                      )}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{row.submitted_at || '-'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="md:hidden space-y-3">
            {data.map((row) => (
              <motion.div key={row.submission_id} variants={itemVariants}>
                <Card className={`cursor-pointer ${row.status === 'cheating' ? 'ring-1 ring-incorrect/40 bg-incorrect-soft' : ''}`} onClick={() => openDetail(row.submission_id)}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-ink dark:text-gray-100 truncate block">{row.respondent_name || 'Anonymous'}{row.is_creator && <span className="text-primary text-xs font-semibold ml-1.5">(you)</span>}</span>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">#{row.submission_id}{isQuiz && row.rank != null ? ` · #${row.rank}` : ''}</p>
                    </div>
<StatusBadge status={row.status} />
                    {row.cheat_reason && (
                      <p className="text-[11px] text-incorrect/80 mt-1 truncate" title={row.cheat_reason}>{row.cheat_reason}</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                    {isQuiz ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-flex items-center justify-center h-6 px-2 rounded-lg text-xs font-semibold ${
                          row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.7
                            ? 'bg-correct-soft text-correct'
                            : row.score != null && row.max_score > 0 && row.score / row.max_score >= 0.4
                              ? 'bg-warn-soft text-warn'
                              : 'bg-gray-100 dark:bg-ink-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {row.score ?? '-'}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">/ {row.max_score ?? '-'}</span>
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
              <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
                Page {page} of {totalPages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-2xl max-h-[88dvh] flex flex-col shadow-lift"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100 truncate">
                    {detail.respondent_name || 'Anonymous'}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                    #{detail.id}
                    {isQuiz && detail.score != null && (
                      <span className="ml-2 font-semibold tabular-nums text-primary">{detail.score} / {detail.max_score}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {detailLoading ? (
                  <div className="text-sm text-gray-400 text-center py-8">Loading...</div>
                ) : detail.answers.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-8">Belum ada jawaban.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-1 h-4 rounded-full bg-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Jawaban pengisi · {detail.answers.length} pertanyaan
                      </span>
                    </div>
                    <div className="space-y-3">
                      {detail.answers.map((a, i) => (
                        <div key={a.question_id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-ink-800/40 px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-ink dark:text-gray-100 leading-snug">
                                <RichText html={a.question_text} className="rich-text" />
                              </div>
                              {a.question_image && (isAudioUrl(a.question_image) ? (
                                <audio controls src={a.question_image} preload="metadata" className="w-full max-w-sm mt-3" />
                              ) : (
                                <img src={a.question_image} alt="" className="max-h-32 w-auto rounded-lg object-cover mt-3" />
                              ))}
                              <div className="mt-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Jawaban</span>
                                  <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
                                </div>
                                <div className="flex items-center gap-3 bg-white dark:bg-ink-900 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2.5">
                                  <div className="flex-1 min-w-0 text-sm font-medium text-ink dark:text-gray-100">
                                    {a.question_type === 'file_upload'
                                      ? (a.answer_file
                                        ? <a href={a.answer_file} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-primary-300 underline">Lihat file jawaban</a>
                                        : <span className="text-gray-400 italic">(tidak dijawab)</span>)
                                      : ['multiple_choice', 'checkbox', 'dropdown'].includes(a.question_type)
                                        ? (a.selected_options?.length
                                          ? a.selected_options.map((s) => sanitizeHtml(s).replace(/<[^>]*>/g, '') || s).join(' · ')
                                          : <span className="text-gray-400 italic">(tidak dijawab)</span>)
                                        : (a.answer_text || <span className="text-gray-400 italic">(tidak dijawab)</span>)}
                                  </div>
                                  {a.is_correct === true && (
                                    <span className="w-6 h-6 rounded-full bg-correct-soft text-correct flex items-center justify-center shrink-0" title="Benar">
                                      <Check className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                  {a.is_correct === false && (
                                    <span className="w-6 h-6 rounded-full bg-incorrect-soft text-incorrect flex items-center justify-center shrink-0" title="Salah">
                                      <X className="w-4 h-4" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
