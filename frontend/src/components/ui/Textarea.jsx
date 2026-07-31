import { forwardRef } from 'react'

const Textarea = forwardRef(({ label, error, helper, className = '', ...props }, ref) => (
  <div>
    {label && (
      <label className="field-label">{label}</label>
    )}
    <textarea
      ref={ref}
      className={`textarea-field ${
        error ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''
      } ${className}`}
      {...props}
    />
    {error ? <p className="field-error">{error}</p> : helper ? <p className="field-hint">{helper}</p> : null}
  </div>
))

Textarea.displayName = 'Textarea'
export { Textarea }
