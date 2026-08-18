import { forwardRef } from 'react'

const variants = {
  primary: 'bg-gradient-to-br from-primary-500 to-primary-700 text-white hover:from-primary-600 hover:to-primary-800 active:from-primary-700 active:to-primary-900 shadow-chip',
  secondary: 'bg-white dark:bg-ink-900 text-ink dark:text-gray-100 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-ink-800 active:bg-gray-100 dark:active:bg-ink-700',
  soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200',
  dark: 'bg-ink text-white hover:bg-ink-800 active:bg-ink-700 shadow-chip',
  ghost: 'text-gray-600 dark:text-gray-400 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 active:bg-gray-200 dark:active:bg-ink-700',
  danger: 'bg-gradient-to-br from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800 active:from-red-700 active:to-red-900 shadow-chip',
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
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-ink-900
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
