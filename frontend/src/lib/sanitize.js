/**
 * Sanitasi minimal HTML dari editor WYSIWYG (hapus script/style/iframe, atribut
 * on*, javascript: URL). DOMParser adalah API browser — tanpa dependency.
 */
export function sanitizeHtml(html = '') {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, iframe, object, embed, form, link, meta').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    ;[...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase()
      const v = (attr.value || '').trim().toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc' || (name === 'href' && v.startsWith('javascript:'))) {
        el.removeAttribute(attr.name)
      }
    })
  })
  return doc.body.innerHTML
}
