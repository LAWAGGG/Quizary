import { AlertTriangle } from 'lucide-react'

export function FallbackPage({ title, message, action }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-paper dark:bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-ink-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-card p-8 text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary mb-5">
            <AlertTriangle className="w-7 h-7" />
          </span>
          <p className="font-display text-4xl font-bold text-ink dark:text-gray-100 leading-none">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{message}</p>
          {action && <div className="mt-8">{action}</div>}
        </div>
      </div>
    </div>
  )
}
