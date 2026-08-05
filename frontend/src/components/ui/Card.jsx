import { forwardRef } from 'react'

export const Card = forwardRef(function Card({ children, className = '', padding = true, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`bg-white rounded-2xl border border-gray-100 shadow-card ${padding ? 'p-5 md:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})
