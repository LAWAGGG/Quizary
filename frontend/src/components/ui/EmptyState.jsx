export function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-16 ${className}`}>
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-card flex items-center justify-center text-gray-300">
          {icon}
        </div>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-paper bg-primary" />
      </div>
      <p className="font-display font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
