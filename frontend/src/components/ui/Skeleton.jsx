export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-ink-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-5 animate-pulse space-y-3">
      <div className="h-5 bg-gray-200/60 dark:bg-ink-700/60 rounded w-3/4" />
      <div className="h-4 bg-gray-200/60 dark:bg-ink-700/60 rounded w-1/2" />
      <div className="h-4 bg-gray-200/60 dark:bg-ink-700/60 rounded w-1/3" />
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200/60 dark:bg-ink-700/60 rounded-xl w-1/3" />
      <div className="h-14 bg-gray-200/60 dark:bg-ink-700/60 rounded-2xl" />
      <div className="h-14 bg-gray-200/60 dark:bg-ink-700/60 rounded-2xl" />
      <div className="h-14 bg-gray-200/60 dark:bg-ink-700/60 rounded-2xl" />
    </div>
  )
}
