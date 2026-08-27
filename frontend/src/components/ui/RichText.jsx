import { useLayoutEffect, useRef } from 'react'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'
import { sanitizeHtml } from '../../lib/sanitize'

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
    ref.current.innerHTML = sanitizeHtml(html)
    try {
      renderMathInElement(ref.current, KATEX_OPTIONS)
    } catch {
      // gagal render → biarkan teks delimiter tampil apa adanya
    }
  }, [html])

  if (!html) return null
  return <span ref={ref} className={className} />
}
