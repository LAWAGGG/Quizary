import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Trophy, TrendingUp, TrendingDown, ArrowLeft, BarChart3 } from 'lucide-react'
import api from '../../api/client'
import { Card, Button, PageHeader, FormSubNav, CardSkeleton } from '../../components/ui'

export default function Analytics() {
  const { formId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/forms/${formId}/analytics`)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [formId])

  if (loading) {
    return (
      <div>
        <div className="mb-2">
          <div className="h-8 bg-gray-200/60 rounded-xl w-48 animate-pulse" />
          <div className="h-4 bg-gray-200/60 rounded-xl w-32 mt-2 mb-8 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="card p-6 animate-pulse mb-8">
          <div className="h-5 bg-gray-200/60 rounded w-1/3 mb-4" />
          <div className="h-12 bg-gray-200/60 rounded-xl mb-3" />
          <div className="h-12 bg-gray-200/60 rounded-xl" />
        </div>
        <div className="card p-6 animate-pulse">
          <div className="h-5 bg-gray-200/60 rounded w-1/3 mb-4" />
          <div className="h-48 bg-gray-200/60 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) return <div className="text-center py-12 text-gray-400">Failed to load data</div>

  const statCards = [
    { label: 'Participants', value: data.total_participants, icon: Users, tint: 'bg-primary-50 text-primary' },
    { label: 'Average Score', value: data.average_score, icon: TrendingUp, tint: 'bg-correct-soft text-correct' },
    { label: 'Highest', value: data.highest_score, icon: Trophy, tint: 'bg-blue-50 text-blue-700' },
    { label: 'Lowest', value: data.lowest_score, icon: TrendingDown, tint: 'bg-warn-soft text-warn' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="How respondents performed on this form."
        actions={
          <Link to={`/forms/${formId}/results`}>
            <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />}>Results</Button>
          </Link>
        }
      />

      <FormSubNav formId={formId} className="mt-5" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {statCards.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="p-5 h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 truncate">{item.label}</p>
                  <p className={`font-display text-3xl font-bold tabular-nums mt-2 ${item.tint.split(' ')[1]}`}>
                    {item.value}
                  </p>
                </div>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.tint}`}>
                  <item.icon className="w-5 h-5" />
                </span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full">
            <h2 className="font-display font-semibold text-ink mb-5">Correct / Wrong Rate</h2>
            <div className="space-y-4">
              <RateRow
                label="Correct"
                pct={Math.round(data.correct_rate * 100)}
                count={data.per_question_stats.reduce((s, q) => s + q.correct_count, 0)}
                barClass="bg-correct"
                textClass="text-correct"
              />
              <RateRow
                label="Wrong"
                pct={Math.round(data.wrong_rate * 100)}
                count={data.per_question_stats.reduce((s, q) => s + q.wrong_count, 0)}
                barClass="bg-incorrect"
                textClass="text-incorrect"
              />
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-ink">Score Distribution</h2>
            </div>
            {data.score_distribution.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No data yet</p>
            ) : (
              <div className="space-y-3">
                {data.score_distribution.map((d) => {
                  const maxCount = Math.max(...data.score_distribution.map((x) => x.count))
                  const pct = maxCount ? (d.count / maxCount) * 100 : 0
                  return (
                    <div key={d.range} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 w-12">{d.range}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-primary rounded-lg"
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-8 text-right tabular-nums">{d.count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6">
        <Card className="overflow-hidden" padding={false}>
          <div className="p-6 pb-4">
            <h2 className="font-display font-semibold text-ink">Per-Question Stats</h2>
          </div>
          {data.per_question_stats.length === 0 ? (
            <div className="p-6 pt-0">
              <p className="text-gray-400 text-sm">No data yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-t border-gray-100 bg-gray-50/70">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Question</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-correct uppercase tracking-wider">Correct</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-incorrect uppercase tracking-wider">Wrong</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.per_question_stats.map((q, i) => {
                    const total = q.correct_count + q.wrong_count
                    const accuracy = total ? Math.round((q.correct_count / total) * 100) : 0
                    return (
                      <tr key={q.question_id} className="border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-ink font-medium">Question {i + 1}</td>
                        <td className="text-center px-4 py-3.5 text-sm text-correct font-semibold tabular-nums">{q.correct_count}</td>
                        <td className="text-center px-4 py-3.5 text-sm text-incorrect font-semibold tabular-nums">{q.wrong_count}</td>
                        <td className="text-center px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accuracy >= 70 ? 'text-correct' : accuracy >= 40 ? 'text-warn' : 'text-incorrect'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {accuracy}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}

function RateRow({ label, pct, count, barClass, textClass }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className={`font-medium ${textClass}`}>{label} · {pct}%</span>
        <span className="text-gray-400 tabular-nums">{count} answers</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${barClass}`}
        />
      </div>
    </div>
  )
}
