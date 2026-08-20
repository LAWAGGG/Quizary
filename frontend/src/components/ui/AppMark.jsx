export function AppMark({ size = 'md', className = '' }) {
  const s = size === 'lg' ? 'w-11 h-11' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  return (
    <img
      src="/Quizary_Logo_Original.png"
      alt="Quizary logo"
      className={`${s} object-contain select-none shrink-0 ${className}`}
    />
  )
}