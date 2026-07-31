export function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-card ${padding ? 'p-5 md:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
