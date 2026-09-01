import { forwardRef, useEffect, useRef, useState, Children } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// Custom listbox menggantikan <select> native — tampilan opsi konsisten di
// semua browser/device. API tetap menerima children <option> sehingga semua
// call-site lama tidak perlu berubah; onChange dipanggil dengan
// { target: { name, value } } seperti event DOM aslinya.
const parseOptions = (children) =>
  Children.toArray(children)
    .filter((el) => el?.type === 'option')
    .map((el, i) => ({
      key: el.key ?? i,
      value: el.props.value ?? '',
      label: el.props.children,
      disabled: !!el.props.disabled,
    }))

const Select = forwardRef(({ label, error, helper, disabled, className = '', value, onChange, name, id, children, onClick, onKeyDown: customOnKeyDown, ...rest }, ref) => {
  const opts = parseOptions(children)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  const isSel = (o) => String(o.value) === String(value ?? '')
  const selected = opts.find(isSel)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Baris aktif (keyboard/hover) selalu terlihat saat panel panjang.
  useEffect(() => {
    if (!open || active < 0 || !listRef.current?.children[active]) return
    listRef.current.children[active].scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const commit = (opt) => {
    setOpen(false)
    if (opt.disabled || isSel(opt)) return
    onChange?.({ target: { name, value: opt.value, type: 'select-one', checked: false } })
  }

  const openPanel = () => {
    if (disabled) return
    setActive(Math.max(0, opts.findIndex(isSel)))
    // Buka ke atas bila ruang bawah sempit — aman juga dipakai di dalam modal.
    const rect = rootRef.current?.getBoundingClientRect()
    setDropUp(!!rect && window.innerHeight - rect.bottom < 240 && rect.top > 260)
    setOpen(true)
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        openPanel()
      }
      return
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
      if (e.key === 'Escape') e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(opts.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(opts.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (opts[active]) commit(opts[active])
    }
  }

  const setRefs = (n) => {
    rootRef.current = n
    if (typeof ref === 'function') ref(n)
    else if (ref) ref.current = n
  }

  return (
    <div className={className}>
      {label && <label className="field-label">{label}</label>}
      {/* stopPropagation: pemakaian lama mengandalkan ini agar klik dropdown
          tidak memicu handler barus/tabel di atasnya (Results.jsx). */}
      <div ref={setRefs} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          {...rest}
          onClick={(e) => {
            onClick?.(e)
            open ? setOpen(false) : openPanel()
          }}
          onKeyDown={(e) => {
            customOnKeyDown?.(e)
            handleKeyDown(e)
          }}
          className={`input-field appearance-none text-left flex items-center justify-between gap-2 cursor-pointer ${className} ${
            error ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`truncate ${!selected || selected.value === '' ? 'text-gray-400 dark:text-gray-500' : ''}`}>
            {selected ? selected.label : opts.length ? opts[0].label : '—'}
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            ref={listRef}
            role="listbox"
            className={`absolute z-50 w-full max-h-60 overflow-y-auto overscroll-contain rounded-xl border py-1 shadow-lift bg-white border-gray-200 dark:bg-ink-800 dark:border-gray-700 ${
              dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {opts.map((o, i) => (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={isSel(o)}
                disabled={o.disabled}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(o)}
                className={`w-full flex items-center gap-2 px-3.5 h-9 text-left text-sm transition-colors ${
                  o.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${i === active ? 'bg-primary/10 text-primary dark:text-primary-300' : 'text-ink dark:text-gray-200'}`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {isSel(o) && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />}
              </button>
            ))}
          </div>
        )}
      </div>
      {error ? <p className="field-error">{error}</p> : helper ? <p className="field-hint">{helper}</p> : null}
    </div>
  )
})

Select.displayName = 'Select'
export { Select }
