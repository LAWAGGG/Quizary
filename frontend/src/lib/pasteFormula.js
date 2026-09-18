import MathML2LaTeX from 'mathml2latex'

const DELIM_RE = /(\$\$[^$]*?\$\$|\\\[[^\]]*?\\\]|\$[^$]*?\$|\\\([^)]*?\\\))/g

function mathmlToLatex(mathNode) {
  const isBlock = (mathNode.getAttribute('display') || '').toLowerCase() === 'block'
  try {
    const latex = MathML2LaTeX.convert(mathNode.outerHTML || mathNode.textContent || '').trim()
    if (!latex) return null
    return isBlock ? `$$${latex}$$` : `$${latex}$`
  } catch {
    return null
  }
}


export function convertMathInHtml(html) {
  if (!html || typeof html !== 'string' || !/<math[\s/>]/i.test(html)) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const mathNodes = [...doc.querySelectorAll('math')]
  if (!mathNodes.length) return null
  let changed = false
  mathNodes.forEach((node) => {
    const wrapped = mathmlToLatex(node)
    if (!wrapped) return
    const span = doc.createElement('span')
    span.textContent = wrapped
    node.replaceWith(span)
    changed = true
  })
  return changed ? doc.body.innerHTML : null
}

export function convertLatexText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return text
  const delimited = text.match(DELIM_RE)
  if (!delimited) return text

  let output = ''
  let last = 0
  text.replace(DELIM_RE, (match, _unused, offset) => {
    const display = match.startsWith('$$') || match.startsWith('\\[')
    const tex = display
      ? match.slice(2, -2).trim()
      : match.startsWith('\\(')
        ? match.slice(2, -2).trim()
        : match.slice(1, -1).trim()
    output += text.slice(last, offset)
    output += display ? `$$${tex}$$` : `$${tex}$`
    last = offset + match.length
    return match
  })
  return output + text.slice(last)
}