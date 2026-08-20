import { useEffect, useRef, useState } from 'react'
import Quill from 'quill'
import Syntax from 'quill/modules/syntax'
import hljs from 'highlight.js/lib/common'
import 'quill/dist/quill.snow.css'

Quill.register('modules/syntax', Syntax, true)

const SYMBOL_GROUPS = [
  { label: 'Math', items: ['+', '−', '±', '×', '÷', '=', '≠', '≈', '∝', '∞'] },
  { label: 'Operators', items: ['∑', '∏', '√', '∛', '∜', '∫', '∬', '∂', '∇', '∆', 'π', '∅'] },
  { label: 'Relations', items: ['<', '>', '≤', '≥', '≪', '≫', '≡', '≅', '∈', '∉'] },
  { label: 'Logic & sets', items: ['∪', '∩', '⊂', '⊃', '⊆', '⊇', '∧', '∨', '¬', '∀', '∃', '→', '⇒', '↔', '⇔'] },
  { label: 'Greek', items: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Δ', 'Σ', 'Π', 'Φ', 'Ψ', 'Ω'] },
  { label: 'Superscript & fractions', items: ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '₀', '₁', '₂', '₃', '₄', '½', '⅓', '⅔', '¼', '¾'] },
  { label: 'Arrows & misc', items: ['←', '↑', '→', '↓', '↔', '↕', '⇐', '⇑', '⇒', '⇓', '⇔', '°', '′', '″', '·', '…', '•', '∴', '∵'] },
]

export function RichTextEditor({ value = '', onChange, placeholder = '', compact = false, minHeight = 140 }) {
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const quillRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const hideTimer = useRef(null)
  const [active, setActive] = useState(false)
  const [symbolsOpen, setSymbolsOpen] = useState(false)
  onChangeRef.current = onChange

  useEffect(() => {
    const container = containerRef.current
    if (!container || quillRef.current) return

    const toolbar = compact
      ? [['bold', 'italic', 'underline', 'link', 'symbol', 'clean']]
      : [
        [{ header: [2, 3, false] }, 'bold', 'italic', 'underline', 'strike', 'code-block', 'link', 'symbol', 'clean'],
      ]

    const quill = new Quill(container, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: toolbar,
          handlers: { symbol: () => setSymbolsOpen((open) => !open) },
        },
        syntax: {
          hljs,
          languages: Syntax.DEFAULTS.languages.filter((l) => l.key === 'plain' || hljs.getLanguage(l.key)),
        },
      },
    })
    quillRef.current = quill

    const symbolBtn = container.parentNode?.querySelector('.ql-symbol')
    if (symbolBtn) symbolBtn.title = 'Insert symbol'

    const normalize = (html) => (html === '<p><br></p>' ? '' : html)

    if (value) quill.clipboard.dangerouslyPasteHTML(value)
    quill.on('text-change', () => {
      onChangeRef.current?.(normalize(quill.root.innerHTML))
    })

    // Toolbar hanya tampil saat editor aktif (fokus). Debounce supaya klik
    // tombol toolbar tidak menutup toolbar sebelum aksi tercatat.
    quill.on('selection-change', (range) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (range) setActive(true)
      else hideTimer.current = setTimeout(() => setActive(false), 250)
    })

    return () => {
      quillRef.current = null
      if (hideTimer.current) clearTimeout(hideTimer.current)
      const parent = container.parentNode
      if (parent) {
        parent.querySelectorAll('.ql-toolbar').forEach((el) => el.remove())
      }
      container.classList.remove('ql-container', 'ql-snow')
      container.innerHTML = ''
    }
  }, [compact, placeholder])

  useEffect(() => {
    const quill = quillRef.current
    if (quill && value !== quill.root.innerHTML) {
      quill.clipboard.dangerouslyPasteHTML(value || '')
    }
  }, [value])

  useEffect(() => {
    if (!symbolsOpen) return
    const onDocClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setSymbolsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [symbolsOpen])

  const insertSymbol = (sym) => {
    const quill = quillRef.current
    if (!quill) return
    const sel = quill.getSelection()
    const index = sel ? sel.index : Math.max(0, quill.getLength() - 1)
    if (sel?.length) quill.deleteText(sel.index, sel.length, 'silent')
    quill.insertText(index, sym, 'user')
    quill.setSelection(index + sym.length, 0, 'silent')
    quill.focus()
    setSymbolsOpen(false)
  }

  return (
    <div ref={wrapperRef} className={`rich-editor relative ${compact ? 'rich-editor-compact' : ''} ${active ? 'rich-editor-active' : ''}`}>
      <div
        ref={containerRef}
        style={{ minHeight }}
        onClick={() => quillRef.current?.root.focus()}
      />
      {symbolsOpen && (
        <div
          className="absolute z-50 bg-white dark:bg-ink-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-[320px] max-h-80 overflow-y-auto"
          style={{ top: compact ? 38 : 52, left: 8 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Symbols</span>
            <button type="button" onClick={() => setSymbolsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close symbols">
              ✕
            </button>
          </div>
          {SYMBOL_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{group.label}</div>
              <div className="grid grid-cols-10 gap-0.5">
                {group.items.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => insertSymbol(s)}
                    title={s}
                    className="h-7 rounded-md text-sm font-medium text-ink dark:text-gray-200 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
