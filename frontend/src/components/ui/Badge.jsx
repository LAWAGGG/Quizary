const schemes = {
  primary: 'bg-primary-50 text-primary-700',
  green: 'bg-correct-soft text-correct',
  red: 'bg-incorrect-soft text-incorrect',
  yellow: 'bg-warn-soft text-warn',
  gray: 'bg-gray-100 dark:bg-ink-800 text-gray-600 dark:text-gray-400',
  blue: 'bg-blue-50 text-blue-700',
}

export function Badge({ children, scheme = 'gray', className = '', ...rest }) {
  return (
    <span {...rest} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${schemes[scheme] || schemes.gray} ${className}`}>
      {children}
    </span>
  )
}

export function TypeBadge({ type }) {
  const isQuiz = type === 'quiz'
  return (
    <Badge scheme={isQuiz ? 'primary' : 'blue'}>{isQuiz ? 'Quiz' : 'Form'}</Badge>
  )
}

export function StatusBadge({ status }) {
  const map = {
    published: { scheme: 'green', label: 'Published' },
    draft: { scheme: 'gray', label: 'Draft' },
    closed: { scheme: 'red', label: 'Closed' },
    submitted: { scheme: 'green', label: 'Submitted' },
    auto_submitted: { scheme: 'yellow', label: 'Auto Submitted' },
    in_progress: { scheme: 'blue', label: 'In Progress' },
    cheating: { scheme: 'red', label: 'Cheating' },
    locked: { scheme: 'yellow', label: 'Locked' },
  }
  const s = map[status] || { scheme: 'gray', label: status }
  return <Badge scheme={s.scheme}>{s.label}</Badge>
}
