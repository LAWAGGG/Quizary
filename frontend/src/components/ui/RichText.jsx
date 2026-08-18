import { sanitizeHtml } from '../../lib/sanitize'

export function RichText({ html, className }) {
  if (!html) return null
  return <span className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
}
