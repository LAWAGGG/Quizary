import { useLayoutEffect, useRef } from 'react'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'
import { sanitizeHtml, plainToHtml } from '../../lib/sanitize'

const HAS_TAG_RE = /<[a-zA-Z][^>]*>/

const KATEX_OPTIONS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '$', right: '$', display: false },
  ],
  ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  throwOnError: false,
  strict: false,
}

export function RichText({ html, className }) {
  const ref = useRef(null)
  const prevHtmlRef = useRef(null)

  // Bypass React DOM: set innerHTML via ref agar output KaTeX tidak
  // di-wipe oleh React reconciliation saat parent re-render.
  useLayoutEffect(() => {
    if (!ref.current || prevHtmlRef.current === html) return
    prevHtmlRef.current = html
    const raw = String(html || '')
    // Plain-text (import docx) tanpa tag: \n/tab/spasi-awal collapse di browser
    // → konversi dulu ke <br>/&nbsp; agar indentasi tampil. HTML kaya utuh.
    ref.current.innerHTML = HAS_TAG_RE.test(raw) ? sanitizeHtml(raw) : sanitizeHtml(plainToHtml(raw))
    try {
      renderMathInElement(ref.current, KATEX_OPTIONS)
    } catch {
      // gagal render → biarkan teks delimiter tampil apa adanya
    }
  }, [html])

  if (!html) return null
  return <span ref={ref} className={className} />
}
