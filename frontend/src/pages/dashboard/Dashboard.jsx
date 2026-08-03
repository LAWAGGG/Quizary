import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Eye, ClipboardList, HelpCircle, Send, Users, TrendingUp, Sparkles } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Card, Button, StatusBadge, CardSkeleton, SpotlightCard, AuroraBg } from '../../components/ui'

const STATS = [
  { key: 'total_forms', label: 'Total Forms', icon: ClipboardList, tint: 'bg-primary-50 text-primary' },
  { key: 'total_quiz', label: 'Quiz', icon: HelpCircle, tint: 'bg-blue-50 text-blue-700' },
  { key: 'total_submissions', label: 'Submissions', icon: Send, tint: 'bg-correct-soft text-correct' },
  { key: 'total_respondents', label: 'Respondents', icon: Users, tint: 'bg-warn-soft text-warn' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <div className="mb-2">
          <div className="h-8 bg-gray-200/60 rounded-xl w-64 animate-pulse" />
          <div className="h-4 bg-gray-200/60 rounded-xl w-48 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 mt-8">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-gray-200/60 rounded w-1/3 mb-4" />
              <div className="h-48 bg-gray-200/60 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const maxTrend = data?.submission_trend?.length ? Math.max(...data.submission_trend.map((t) => t.count)) : 1
  const firstName = (user?.name || 'User').split(' ')[0]

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary to-primary-800 p-6 md:p-8 text-white shadow-lift"
      >
        <AuroraBg base="#ffffff" className="opacity-30" />
        <div className="absolute inset-0 dot-grid-light opacity-60 pointer-events-none" aria-hidden="true" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <Sparkles className="w-3.5 h-3.5" />
              Dashboard
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-bold mt-2">
              Welcome back, {firstName}
            </h1>
            <p className="text-white/75 text-sm mt-1.5">Here's how your forms are performing today.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" onClick={() => navigate('/forms')} icon={<Eye className="w-4 h-4" />}>
              All Forms
            </Button>
            <Button onClick={() => navigate('/forms/new')} style={{ backgroundImage: 'none', backgroundColor: '#fff', color: '#6C5CE7' }} className="hover:bg-white/90" icon={<Plus className="w-4 h-4" />}>
              New Form
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {STATS.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <SpotlightCard className="h-full">
              <Card className="p-5 h-full hover:border-primary/30 hover:shadow-lift transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500 truncate">{item.label}</p>
                    <p className="font-display text-3xl font-bold text-ink mt-2 tabular-nums">
                      {data?.[item.key] ?? 0}
                    </p>
                  </div>
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-chip ${item.tint}`}>
                    <item.icon className="w-5 h-5" />
                  </span>
                </div>
              </Card>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-ink">Recent Forms</h2>
              <Link to="/forms" className="text-sm font-medium text-primary hover:text-primary-600 transition-colors">
                View all
              </Link>
            </div>
            {!data?.recent_forms?.length ? (
              <div className="text-center py-10">
                <p className="text-gray-400 text-sm mb-4">No forms yet — create one to start collecting answers.</p>
                <Button size="sm" onClick={() => navigate('/forms/new')} icon={<Plus className="w-4 h-4" />}>
                  Create a Form
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
                      <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_forms?.map((f) => (
                      <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 pr-3 text-sm font-medium text-ink">
                          <Link to={`/forms/${f.id}/results`} className="hover:text-primary transition-colors">
                            {f.title}
                          </Link>
                        </td>
                        <td className="py-3.5 pr-3">
                          <StatusBadge status={f.status} />
                        </td>
                        <td className="py-3.5 text-sm text-right text-gray-500 tabular-nums">{f.submission_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="h-full">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-ink">Submission Trend</h2>
            </div>
            {!data?.submission_trend?.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <p className="text-gray-300 text-4xl font-display font-bold">0</p>
                <p className="text-gray-400 text-sm mt-2">Answers will show up here as they come in.</p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 h-48">
                  {data?.submission_trend?.map((t, i) => {
                    const height = Math.max((t.count / maxTrend) * 100, 4)
                    return (
                      <motion.div
                        key={t.date}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.5, delay: 0.5 + i * 0.05 }}
                        className="flex-1 bg-primary rounded-t-lg min-h-[4px] relative group"
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {t.count}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-3 text-xs text-gray-400">
                  {data.submission_trend.filter((_, i) => i === 0 || i === data.submission_trend.length - 1).map((t) => (
                    <span key={t.date}>{t.date}</span>
                  ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
