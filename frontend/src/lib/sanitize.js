/**
 * Sanitasi HTML dari editor WYSIWYG — berbasis ALLOWLIST.
 *
 * Strategi: parse dengan DOMParser, lalu bangun ulang string HTML hanya dari
 * node yang diizinkan (tag, atribut, protokol href), dengan teks di-escape
 * manual. Output dibangun dari nol — bukan serialisasi ulang markup asli —
 * sehingga pola mutation-XSS (mXSS) tidak bisa lolos lewat round-trip innerHTML.
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
  'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
  'PRE', 'CODE', 'A', 'SPAN',
])

// Tag berbahaya: buang BESERTA isinya. Tag lain yang tidak dikenal cukup
// di-unwrap (isi tetap tampil, bungkusnya dilepas).
const DROP_WITH_CONTENT = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'LINK', 'META',
  'BASE', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'FRAME', 'FRAMESET',
  'APPLET', 'AUDIO', 'VIDEO', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
  'CANVAS', 'DIALOG', 'SLOT',
])

const SAFE_CLASS_RE = /^[A-Za-z0-9_.\- ]*$/   // contoh pemakaian sah: class hljs dari Quill syntax
const SAFE_HREF_RE = /^(https?:\/\/|mailto:)/i

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function safeAttrs(el) {
  const tag = el.tagName
  const attrs = []
  if (tag === 'A') {
    const href = (el.getAttribute('href') || '').trim()
    if (href && SAFE_HREF_RE.test(href)) attrs.push(`href="${escapeText(href)}"`)
  }
  if (tag === 'SPAN' || tag === 'PRE' || tag === 'CODE') {
    const cls = el.getAttribute('class') || ''
    if (cls && SAFE_CLASS_RE.test(cls)) attrs.push(`class="${escapeText(cls)}"`)
  }
  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

function serialize(node) {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeText(child.nodeValue ?? '')
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const tag = child.tagName
    if (DROP_WITH_CONTENT.has(tag)) continue
    if (!ALLOWED_TAGS.has(tag)) {
      out += serialize(child) // unwrap: isi dilestarikan, bungkus dibuang
      continue
    }
    const inner = serialize(child)
    if (tag === 'BR') {
      out += '<br/>'
      continue
    }
    out += `<${tag.toLowerCase()}${safeAttrs(child)}>${inner}</${tag.toLowerCase()}>`
  }
  return out
}

export function sanitizeHtml(html = '') {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return serialize(doc.body)
}
