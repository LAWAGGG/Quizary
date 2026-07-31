export function AppMark({ size = 'md', inverse = false, className = '' }) {
  const s = size === 'lg' ? 'w-11 h-11 text-lg' : size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-base'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-display font-bold select-none ${s} ${
        inverse ? 'bg-white text-primary shadow-chip' : 'bg-primary text-white shadow-chip'
      } ${className}`}
    >
      Q
    </span>
  )
}
