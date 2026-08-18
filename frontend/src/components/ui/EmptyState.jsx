export function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-16 ${className}`}>
      <div className="w-14 h-14 mb-5 rounded-2xl bg-white dark:bg-ink-900 border border-gray-200 dark:border-gray-700 shadow-card flex items-center justify-center text-gray-300 dark:text-gray-600">
        {icon}
      </div>
      <p className="font-display font-semibold text-ink dark:text-gray-100">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
