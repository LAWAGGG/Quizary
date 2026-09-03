import { forwardRef, useCallback, useEffect, useRef } from 'react'

const Textarea = forwardRef(({ label, error, helper, className = '', autoGrow = true, onInput, ...props }, ref) => {
  const innerRef = useRef(null)

  const setRefs = useCallback(
    (el) => {
      innerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref]
  )

  const grow = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    if (autoGrow) grow()
  }, [grow, autoGrow, props.value])

  return (
    <div>
      {label && (
        <label className="field-label">{label}</label>
      )}
      <textarea
        ref={setRefs}
        onInput={(e) => {
          if (autoGrow) grow()
          onInput?.(e)
        }}
        className={`textarea-field ${
          error ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''
        } ${className}`}
        {...props}
      />
      {error ? <p className="field-error">{error}</p> : helper ? <p className="field-hint">{helper}</p> : null}
    </div>
  )
})

Textarea.displayName = 'Textarea'
export { Textarea }
