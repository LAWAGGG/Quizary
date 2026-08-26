import { useEffect, useRef } from 'react'
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
  // pre/code tetap mentah — rumus di dalam code block tidak dirender
  ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  throwOnError: false,
  strict: false,
}

export function RichText({ html, className }) {
  const ref = useRef(null)

  // Jalankan tiap render tanpa deps: dangerouslySetInnerHTML mengganti DOM
  // saat html berubah, dan auto-render idempoten (hasil .katex sudah tak
  // punya delimiter sehingga tak diproses ulang).
  useEffect(() => {
    if (ref.current) {
      try {
        renderMathInElement(ref.current, KATEX_OPTIONS)
      } catch {
        // gagal render → biarkan teks delimiter tampil apa adanya
      }
    }
  })

  if (!html) return null
  return <span ref={ref} className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
}
