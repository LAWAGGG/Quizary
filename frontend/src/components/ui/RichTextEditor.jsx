import { useEffect, useMemo, useRef, useState } from 'react'
import Quill from 'quill'
import Syntax from 'quill/modules/syntax'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import 'quill/dist/quill.snow.css'
import { Button } from './Button'

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

// Template LaTeX — klik untuk menambahkan ke draft formula
const FORMULA_TEMPLATES = [
  { label: 'a/b', tex: '\\frac{a}{b}' },
  { label: 'x²', tex: 'x^{2}' },
  { label: '√', tex: '\\sqrt{x}' },
  { label: '∑', tex: '\\sum_{i=1}^{n} a_i' },
  { label: '∫', tex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: 'lim', tex: '\\lim_{x \\to \\infty} f(x)' },
]

export function RichTextEditor({ value = '', onChange, placeholder = '', compact = false, minHeight = 140 }) {
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const quillRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const hideTimer = useRef(null)
  const isInternalChange = useRef(false)
  const normalize = (html) => {
    if (!html || html === '<p><br></p>') return ''
    return String(html).replace(/<select[^>]*class="ql-ui"[^>]*>[\s\S]*?<\/select>/gi, '')
  }
  const [active, setActive] = useState(false)
  const [symbolsOpen, setSymbolsOpen] = useState(false)
  // Dialog formula: { tex, index, length } — index/length = rentang
  // teks editor yang diganti saat disisipkan (edit rumus existing).
  const [formula, setFormula] = useState(null)
  onChangeRef.current = onChange

  useEffect(() => {
    const container = containerRef.current
    if (!container || quillRef.current) return

    const toolbar = compact
      ? [['bold', 'italic', 'underline', 'code-block', 'link', 'fx', 'clean']]
      : [
        ['bold', 'italic', 'underline', 'strike', 'code-block', 'link', 'fx', 'clean'],
      ]

    const handleCodeBlock = () => {
      const quill = quillRef.current
      if (!quill) return
      const range = quill.getSelection(true)
      if (!range) return
      if (range.length === 0) {
        const fmt = quill.getFormat(range)
        const isBlock = !!fmt['code-block']
        quill.format('code-block', !isBlock, 'user')
        quill.format('code', false, 'user')
        quill.setSelection(range.index, 0, 'user')
        quill.focus()
      } else {
        const isBlock = !!quill.getFormat(range)['code-block']
        // pakai formatText agar toggle block untuk semua baris dalam range (1 container, bukan pill)
        quill.formatText(range.index, range.length, 'code-block', !isBlock, 'user')
        quill.formatText(range.index, range.length, 'code', false, 'user')
        // collapse ke dalam akhir block (sebelum newline pembatas) biar ketik lanjut di dalam, tidak terbalik & tidak keluar
        let end = range.index + range.length
        const len = quill.getLength()
        if (end > len) end = len
        if (end > 0 && quill.getText(end - 1, 1) === '\n') {
          try {
            const beforeFmt = quill.getFormat(end - 1, 1)
            if (beforeFmt['code-block']) end = end - 1
          } catch {}
        }
        quill.setSelection(end, 0, 'user')
        quill.focus()
      }
    }

    const quill = new Quill(container, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: toolbar,
          handlers: {
            symbol: () => setSymbolsOpen((open) => !open),
            fx: () => openFormulaDialog(),
            'code-block': handleCodeBlock,
          },
        },
        syntax: {
          hljs,
          languages: Syntax.DEFAULTS.languages.filter((l) => l.key === 'plain' || hljs.getLanguage(l.key)),
        },
      },
    })
    quillRef.current = quill
    quill.root.setAttribute('spellcheck', 'false')

    const symbolBtn = container.parentNode?.querySelector('.ql-symbol')
    if (symbolBtn) symbolBtn.title = 'Insert symbol'

    const fxBtn = container.parentNode?.querySelector('.ql-fx')
    if (fxBtn) fxBtn.title = 'Insert LaTeX formula (Ctrl+Alt+M)'

    // Shortcut buka dialog formula
    quill.keyboard.addBinding({ key: 'm', shortKey: true, altKey: true }, () => {
      openFormulaDialog()
      return false
    })

    // Tab di dalam code-block → sisipkan tab nyata (preserve indent), bukan pindah focus
    quill.keyboard.addBinding({ key: 'Tab' }, (range, context) => {
      if (context.format['code-block']) {
        quill.insertText(range.index, '\t', 'user')
        quill.setSelection(range.index + 1, 0, 'silent')
        return false
      }
      return true
    })
    quill.keyboard.addBinding({ key: 'Tab', shiftKey: true }, (range, context) => {
      if (context.format['code-block'] && range.index > 0) {
        const text = quill.getText(Math.max(0, range.index - 4), 4)
        // outdent sederhana: hapus hingga 1 tab / 4 spasi di sebelum cursor
        if (text.endsWith('\t')) {
          quill.deleteText(range.index - 1, 1, 'user')
          quill.setSelection(range.index - 1, 0, 'silent')
          return false
        }
        if (text.endsWith('    ')) {
          quill.deleteText(range.index - 4, 4, 'user')
          quill.setSelection(range.index - 4, 0, 'silent')
          return false
        }
      }
      return true
    })

    if (value) quill.clipboard.dangerouslyPasteHTML(value)
    quill.on('text-change', (_delta, _old, source) => {
      if (source === 'user') isInternalChange.current = true
      onChangeRef.current?.(normalize(quill.root.innerHTML))
    })

    // Toolbar tampil saat editor aktif. Pakai focusin/focusout native (bukan
    // selection-change Quill) — event selection Quill kadang tidak emit saat
    // klik/fokus (quill#1324, quill#2186) sehingga toolbar bisa tak muncul.
    // Debounce supaya klik tombol toolbar tidak menutup toolbar sebelum aksi
    // tercatat.
    const wrapper = container.parentNode
    const onFocusIn = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setActive(true)
    }
    const onFocusOut = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setActive(false), 250)
    }
    wrapper?.addEventListener('focusin', onFocusIn)
    wrapper?.addEventListener('focusout', onFocusOut)

    return () => {
      wrapper?.removeEventListener('focusin', onFocusIn)
      wrapper?.removeEventListener('focusout', onFocusOut)
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
    if (!quill) return
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    if (normalize(value) !== normalize(quill.root.innerHTML)) {
      quill.clipboard.dangerouslyPasteHTML(value || '')
    }
  }, [value])

  useEffect(() => {
    if (!symbolsOpen && !formula) return
    const onDocClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setSymbolsOpen(false)
        setFormula(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [symbolsOpen, formula])

  // Buka dialog formula. Bila seleksi editor berupa rumus $..$ / $$..$$,
  // isi draft dengannya supaya bisa diedit lalu diganti saat disimpan.
  const openFormulaDialog = () => {
    const quill = quillRef.current
    if (!quill) return
    const sel = quill.getSelection()
    let tex = ''
    const index = sel ? sel.index : Math.max(0, quill.getLength() - 1)
    let length = sel ? sel.length : 0

    if (sel?.length) {
      const text = quill.getText(sel.index, sel.length)
      const m = text.match(/^\$\$([\s\S]+)\$\$$/) || text.match(/^\$([\s\S]+)\$$/)
      if (m) {
        tex = m[1]
        // Ganti utuh termasuk delimiternya saat save
      } else {
        // Seleksi biasa akan ditimpa oleh rumus baru
      }
    }

    setFormula({ tex, index, length })
  }

  // Mode render ditentukan otomatis dari isi rumus — user tidak perlu tahu
  // soal delimiter $/$$. Rumus "berat" (pecahan, sigma, integral, matriks)
  // tampil sebagai blok center; rumus ringkas menyatu dengan teks.
  const isDisplayTex = (tex) => /\\(frac|dfrac|tfrac|sum|int|prod|lim|begin)(?![a-zA-Z])|\\\\/.test(tex)

  const saveFormula = () => {
    const quill = quillRef.current
    if (!quill || !formula) return
    const tex = formula.tex.trim()
    setFormula(null)
    if (!tex) return
    const wrap = isDisplayTex(tex) ? '$$' : '$'
    const text = `${wrap}${tex}${wrap}`
    quill.deleteText(formula.index, formula.length, 'silent')
    quill.insertText(formula.index, text, 'user')
    quill.setSelection(formula.index + text.length, 0, 'silent')
    quill.focus()
  }

  const appendTemplate = (tex) => {
    setFormula((f) => (f ? { ...f, tex: f.tex.trim() ? `${f.tex.trim()} ${tex} ` : `${tex} ` } : f))
  }

  // Live preview — throwOnError agar error parse bisa ditampilkan sebagai pesan
  const formulaPreview = useMemo(() => {
    const tex = formula?.tex.trim()
    if (!tex) return null
    try {
      return { html: katex.renderToString(tex, { throwOnError: true, displayMode: isDisplayTex(tex) }) }
    } catch (err) {
      return { error: err.message?.replace(/^KaTeX parse error:\s*/, '') || 'Invalid syntax' }
    }
  }, [formula])

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
        spellCheck={false}
        autoCorrect="off"
        autoComplete="off"
        onClick={() => quillRef.current?.focus()}
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
      {formula && (
        <div
          className="absolute z-50 bg-white dark:bg-ink-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-[360px] max-w-[calc(100vw-2rem)]"
          style={{ top: compact ? 38 : 52, left: 8 }}
          role="dialog"
          aria-label="Insert LaTeX formula"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Formula LaTeX</span>
            <button type="button" onClick={() => setFormula(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close formula">
              ✕
            </button>
          </div>

          <input
            value={formula.tex}
            onChange={(e) => setFormula((f) => ({ ...f, tex: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveFormula() }
              if (e.key === 'Escape') { e.preventDefault(); setFormula(null) }
            }}
            placeholder="\frac{a}{b} + \sqrt{x^2+1}"
            className="input-field h-9 font-mono text-sm w-full"
            autoFocus
            spellCheck={false}
          />

          <div
            className={`mt-2 min-h-[64px] max-h-32 overflow-x-auto overflow-y-hidden flex items-center justify-center rounded-lg border px-3 py-2 ${
              formulaPreview?.error
                ? 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30'
                : 'border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-ink-900/60'
            }`}
            aria-live="polite"
          >
            {formulaPreview?.error ? (
              <span className="text-xs text-red-500 dark:text-red-400">{formulaPreview.error}</span>
            ) : formulaPreview ? (
              <span dangerouslySetInnerHTML={{ __html: formulaPreview.html }} />
            ) : (
              <span className="text-xs italic text-gray-400 dark:text-gray-500">Formula preview appears here</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {FORMULA_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => appendTemplate(t.tex)}
                title={t.tex}
                className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end mt-3">
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setFormula(null)}>Cancel</Button>
              <Button size="sm" onClick={saveFormula} disabled={!formula.tex.trim()}>Insert</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
