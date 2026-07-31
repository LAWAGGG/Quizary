import { forwardRef } from 'react'

const Select = forwardRef(({ label, error, helper, children, className = '', ...props }, ref) => (
  <div>
    {label && (
      <label className="field-label">{label}</label>
    )}
    <select
      ref={ref}
      className={`input-field appearance-none pr-10 bg-no-repeat bg-[right_12px_center] bg-[length:16px]
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%23837E74%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22/%3E%3C/svg%3E')]
        ${
          error ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''
        } ${className}`}
      {...props}
    >
      {children}
    </select>
    {error ? <p className="field-error">{error}</p> : helper ? <p className="field-hint">{helper}</p> : null}
  </div>
))

Select.displayName = 'Select'
export { Select }
