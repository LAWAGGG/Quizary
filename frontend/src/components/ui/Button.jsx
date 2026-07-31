import { forwardRef } from 'react'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-600 active:bg-primary-700 shadow-chip',
  secondary: 'bg-white text-ink border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100',
  soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200',
  dark: 'bg-ink text-white hover:bg-ink-800 active:bg-ink-700 shadow-chip',
  ghost: 'text-gray-600 hover:text-ink hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-incorrect text-white hover:bg-red-600 active:bg-red-700 shadow-chip',
  'ghost-danger': 'text-incorrect hover:bg-incorrect-soft active:bg-red-100',
}

const sizes = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-[52px] px-6 text-sm gap-2',
  xl: 'h-[60px] px-8 text-base gap-2',
}

const Button = forwardRef(({ variant = 'primary', size = 'md', loading, icon, children, className = '', ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 whitespace-nowrap
      active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white
      ${variant === 'primary' || variant === 'dark' || variant === 'danger' ? 'font-semibold' : ''}
      ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  >
    {loading && (
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {icon && !loading && icon}
    {children}
  </button>
))

Button.displayName = 'Button'
export { Button }
