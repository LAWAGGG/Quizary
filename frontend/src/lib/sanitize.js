/**
 * Sanitasi HTML dari editor WYSIWYG (Quill) — berbasis DOMPurify.
 *
 * Config allowlist ketat: hanya tag & atribut yang benar-benar dipakai aplikasi
 * (termasuk `data-list` milik list Quill 2). Protokol href dibatasi http(s)/
 * mailto sehingga `javascript:` tidak mungkin lolos. DOMPurify sendiri tahan
 * mXSS — outputnya dibangun dari serialisasi DOM yang sudah dibersihkan.
 */
import DOMPurify from 'dompurify'

const CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
    'pre', 'code', 'a', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'class', 'data-list', 'data-language', 'spellcheck'],
  ALLOW_DATA_ATTR: false,
  // Protokol href: http(s) & mailto saja (blokir javascript:, data:, vbscript:, dst.)
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}

export function sanitizeHtml(html = '') {
  if (!html) return ''
  // buang UI chrome Quill (language picker) sebelum sanitasi — dia bukan konten
  const stripped = String(html).replace(/<select[^>]*class="ql-ui"[^>]*>[\s\S]*?<\/select>/gi, '')
  return DOMPurify.sanitize(stripped, CONFIG)
}

/** Decode entitas HTML (&lt; &gt; &amp; ...) — loop hingga stabil untuk data escape-ganda. */
export function decodeEntities(s = '') {
  let prev = String(s || '')
  if (typeof document !== 'undefined') {
    const ta = document.createElement('textarea')
    for (let i = 0; i < 3; i++) {
      ta.innerHTML = prev
      if (ta.value === prev) break
      prev = ta.value
    }
    return prev
  }
  return prev
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

const HAS_TAG_RE = /<[a-zA-Z][^>]*>/
const HAS_ESCAPED_TAG_RE = /&lt;\/?[a-zA-Z]|&amp;lt;|&#0*60;/

/** Normalisasi HTML kaya sebelum render: data escape-ganda tanpa tag asli
 *  (mis. `test&lt;p&gt;X&lt;/p&gt;` dari AI/import) di-decode sekali agar
 *  format WYSIWYG tampil; HTML editor normal dibiarkan apa adanya agar
 *  teks literal seperti `&lt;p&gt;` tidak berubah jadi tag. */
export function resolveRichHtml(html = '') {
  const raw = String(html || '')
  if (!raw || HAS_TAG_RE.test(raw)) return raw
  if (!HAS_ESCAPED_TAG_RE.test(raw)) return raw
  const decoded = decodeEntities(raw)
  return HAS_TAG_RE.test(decoded) ? decoded : raw
}

/** Buang tag HTML → teks polos (untuk URL param, nama file, teks 1 baris). */
export function stripTags(html = '') {
  const raw = String(html || '')
  const hadTags = HAS_TAG_RE.test(raw)
  let text = decodeEntities(raw.replace(/<[^>]*>/g, ' '))
  if (!hadTags && HAS_TAG_RE.test(text)) {
    text = decodeEntities(text.replace(/<[^>]*>/g, ' '))
  }
  return text.replace(/\s+/g, ' ').trim()
}
