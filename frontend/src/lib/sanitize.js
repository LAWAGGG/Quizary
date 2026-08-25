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
    'pre', 'code', 'a', 'span',
  ],
  ALLOWED_ATTR: ['href', 'class', 'data-list'],
  ALLOW_DATA_ATTR: false,
  // Protokol href: http(s) & mailto saja (blokir javascript:, data:, vbscript:, dst.)
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}

export function sanitizeHtml(html = '') {
  if (!html) return ''
  return DOMPurify.sanitize(html, CONFIG)
}

/** Buang tag HTML → teks polos (untuk URL param, nama file, teks 1 baris). */
export function stripTags(html = '') {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
