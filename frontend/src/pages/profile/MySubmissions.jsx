import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, ClipboardList } from 'lucide-react'
import api from '../../api/client'
import { Card, Button, StatusBadge, PageHeader, EmptyState, CardSkeleton, RichText } from '../../components/ui'

export default function MySubmissions() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/me/submissions')
      .then((res) => setData(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Your activity"
        title="My Submissions"
        description="Every form or quiz you've answered."
      />

      {loading ? (
        <div className="space-y-4 mt-6">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<ClipboardList className="w-6 h-6" />}
            title="No submissions yet"
            description="You haven't filled out any forms or quizzes yet."
            action={
              <Button onClick={() => navigate('/')} variant="secondary">
                Back to Dashboard
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="space-y-3 mt-6"
        >
          {data.map((sub) => (
            <motion.div
              key={sub.id}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            >
              <Card
                className="cursor-pointer hover:border-primary/40 hover:shadow-lift transition-all"
                onClick={() => navigate(`/s/${sub.id}?type=${sub.type || 'form'}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-semibold text-ink dark:text-gray-100 truncate"><RichText html={sub.form_title} /></h3>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                    </div>
                    {sub.type !== 'quiz' && sub.reveal_score && sub.score !== null && sub.score !== undefined && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Score: <span className="font-semibold text-ink dark:text-gray-100 tabular-nums">{sub.score}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {sub.submitted_at ? `Submitted: ${sub.submitted_at}` : 'Not submitted yet'}
                    </p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
