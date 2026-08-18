import { useEffect, useRef } from 'react'
import Quill from 'quill'
import Syntax from 'quill/modules/syntax'
import hljs from 'highlight.js/lib/common'
import 'quill/dist/quill.snow.css'

Quill.register('modules/syntax', Syntax, true)

export function RichTextEditor({ value = '', onChange, placeholder = '', compact = false, minHeight = 140 }) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const container = containerRef.current
    if (!container || quillRef.current) return

    const toolbar = compact
      ? [['bold', 'italic', 'underline'], ['link'], ['clean']]
      : [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean'],
      ]

    const quill = new Quill(container, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar,
        syntax: {
          hljs,
          languages: Syntax.DEFAULTS.languages.filter((l) => l.key === 'plain' || hljs.getLanguage(l.key)),
        },
      },
    })
    quillRef.current = quill

    const normalize = (html) => (html === '<p><br></p>' ? '' : html)

    if (value) quill.clipboard.dangerouslyPasteHTML(value)
    quill.on('text-change', () => {
      onChangeRef.current?.(normalize(quill.root.innerHTML))
    })

    return () => {
      quillRef.current = null
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

  return (
    <div className={`rich-editor ${compact ? 'rich-editor-compact' : ''}`}>
      <div ref={containerRef} style={{ minHeight }} />
    </div>
  )
}
