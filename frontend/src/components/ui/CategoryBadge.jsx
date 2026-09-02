export function CategoryBadge({ category, size = 'sm' }) {
  if (!category) return null
  const color = category.color || '#6C5CE7'
  const sm = size === 'sm'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium bg-white dark:bg-ink-800 ${sm ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'}`}
      style={{ borderColor: `${color}30`, color }}
      title={category.name}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate max-w-[110px]">{category.name}</span>
    </span>
  )
}

export function CategoryDot({ color = '#6C5CE7', size = 8 }) {
  return <span className="rounded-full shrink-0" style={{ width: size, height: size, backgroundColor: color }} />
}
