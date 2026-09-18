import MathML2LaTeX from 'mathml2latex'

const DELIM_RE = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$]+?\$|\\\([\s\S]*?\\\))/g
const MATH_MARKER_RE = /<math[\s/>]|&(?:lt|#0*60;?)\s*math|mathml|annotation|katex|ql-formula|mjx-|mathjax|\\\(|\\\[/i
const RAW_MATHML_TAG_RE = /<math(?:\s|\/|>)/i
const RAW_MATHML_RE = /<math(?:\s[^>]*)?>[\s\S]*?<\/math\s*>|<math(?:\s[^>]*)?\/>/gi
const ESCAPED_MATHML_RE = /&lt;\s*math(?:\s[\s\S]*?)?&gt;[\s\S]*?&lt;\/\s*math\s*&gt;|&lt;\s*math(?:\s[^;]*?)?\/&gt;|&#0*60;\s*math(?:\s[\s\S]*?)?&#0*62;[\s\S]*?&#0*60;\/\s*math\s*&#0*62;|&#0*60;\s*math(?:\s[^;]*?)?\/&#0*62;/gi
const ESCAPED_MATH_HINT_RE = /&(?:lt|#0*60;?)\s*math/i
const ASSISTIVE_SEL = 'annotation, .katex-mathml, .mjx-assistive-mml'

// Perintah LaTeX umum TANPA delimiter — teks seperti
// "nilai limit dari \lim_{x\to 0}{...}" tetap dikenali sebagai rumus.
const BARE_CMD_RE = /\\(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|omicron|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|aleph|ell|Re|Im|frac|dfrac|tfrac|cfrac|binom|dbinom|tbinom|sqrt|root|sum|prod|coprod|int|oint|iint|iiint|lim|liminf|limsup|inf|sup|max|min|arg|deg|det|dim|exp|gcd|hom|ker|lg|ln|log|Pr|sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh|coth|left|right|bigl|Bigr|biggl|Biggr|bigm|Bigm|biggm|Biggm|to|gets|mapsto|longmapsto|leftarrow|rightarrow|leftrightarrow|Leftarrow|Rightarrow|Leftrightarrow|longleftarrow|longrightarrow|uparrow|downarrow|updownarrow|Uparrow|Downarrow|Updownarrow|nearrow|searrow|swarrow|nwarrow|infty|partial|nabla|forall|nexists|exists|lnot|neg|wedge|vee|cap|cup|setminus|subset|supset|subseteq|supseteq|subsetneq|supsetneq|sqsubset|sqsupset|sqsubseteq|sqsupseteq|in|notin|ni|emptyset|varnothing|propto|perp|parallel|mid|nmid|angle|triangle|sim|simeq|cong|approx|asymp|doteq|equiv|models|vdash|bowtie|lt|gt|le|ge|leq|geq|leqq|geqq|neq|lneq|gneq|ll|gg|prec|succ|preceq|succeq|pm|mp|times|div|cdot|ast|star|circ|bullet|diamond|oplus|ominus|otimes|oslash|odot|dagger|ddagger|bigcup|bigcap|bigvee|bigwedge|bigsqcup|bigoplus|bigotimes|wr|sharp|flat|natural|surd|top|bot|bar|hat|tilde|vec|dot|ddot|breve|check|acute|grave|mathring|overline|underline|overbrace|underbrace|overrightarrow|overleftarrow|overleftrightarrow|widehat|widetilde|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathbb|boldsymbol|text|textbf|textit|operatorname|displaystyle|textstyle|scriptstyle|scriptscriptstyle|limits|nolimits|underset|overset|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|align|gathered|multline|smallmatrix|quad|qquad|hspace|vspace|kern|ldots|cdots|vdots|ddots|dots|dotsb|dotsc|dotsi|dotsm|prime|backprime|colon|newline)(?![a-zA-Z])|\\(?:[,;:!| ]|[{}%$&#_~^'])/

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

// MathML mentah sebagai TEKS (copy source dari AI/code): "<math ...>...</math>"
// atau escaped "&lt;math ...&gt;...". Tanpa delimiter/backslash sehingga lolos
// deteksi → Quill paste sebagai HTML hidup → browser render native MathML =
// "preview dalam editor". Decode + convert ke $...$ di sini.
function decodeMatchEntities(s) {
  let out = String(s || '')
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#0*(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
  }
  return out
}

function mathmlFragmentToLatex(fragment) {
  const display = /display\s*=\s*["']?block/i.test(fragment)
  try {
    const latex = MathML2LaTeX.convert(fragment).trim()
    if (!latex) return null
    return display ? `$$${latex}$$` : `$${latex}$`
  } catch {
    return null
  }
}

export function replaceRawMathml(text) {
  if (!text || typeof text !== 'string') return text
  const decoded = ESCAPED_MATH_HINT_RE.test(text)
    ? String(text).replace(ESCAPED_MATHML_RE, (m) => decodeMatchEntities(m))
    : String(text)
  if (!RAW_MATHML_TAG_RE.test(decoded)) return decoded !== text ? decoded : text
  return decoded.replace(RAW_MATHML_RE, (m) => mathmlFragmentToLatex(m) ?? m)
}

function annotationOf(node) {
  return node.querySelector?.('annotation')?.textContent?.trim()
    || node.getAttribute?.('data-value')?.trim()
    || null
}

// Teks datar tanpa duplikasi: buang subtree assistive (mathml/annotation)
// yang bikin textContent ganda ("3x²+2.../..3x²+2").
function plainFlatten(node) {
  const clone = node.cloneNode(true)
  clone.querySelectorAll(ASSISTIVE_SEL).forEach((n) => n.remove())
  return (clone.textContent || '').replace(/\s+/g, ' ').trim()
}

function katexToLatex(node, display) {
  const ann = annotationOf(node)
  if (ann) return display ? `$$${ann}$$` : `$${ann}$`
  // Tanpa annotation (copy dari render tanpa MathML): visual saja tanpa
  // delimiter = teks mati di editor. Bungkus $...$ agar tetap raw editable
  // dan render di Preview Formula + halaman publik.
  const visual = plainFlatten(node)
  if (!visual) return null
  return display ? `$$${visual}$$` : `$${visual}$`
}

function blockText(doc) {
  doc.body.querySelectorAll('br').forEach((node) => node.replaceWith(doc.createTextNode('\n')))
  doc.body.querySelectorAll('p, div, li, h1, h2, h3, h4, blockquote, tr').forEach((node) => {
    node.after(doc.createTextNode('\n'))
  })
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n')
}

// Urutan penting: .katex DULU (pakai annotation mentah), baru <math> sisa.
// Kalau <math> duluan, annotation di dalam katex ikut hancur dan fallback
// jatuh ke teks visual → ganda.
function replaceMathNodes(doc) {
  let changed = false
  const replace = (node, latex) => {
    if (!node || node.parentNode == null || !latex) return
    node.replaceWith(doc.createTextNode(latex))
    changed = true
  }
  doc.querySelectorAll('.katex-display').forEach((node) => replace(node, katexToLatex(node, true)))
  doc.querySelectorAll('.katex').forEach((node) => replace(node, katexToLatex(node, false)))
  doc.querySelectorAll('math').forEach((node) => replace(node, mathmlToLatex(node) ?? plainFlatten(node)))
  doc.querySelectorAll('.mjx-container, .MathJax').forEach((node) => replace(node, katexToLatex(node, false) ?? plainFlatten(node)))
  doc.querySelectorAll('.ql-formula, .ql-formula-container').forEach((node) => {
    const value = node.getAttribute('data-value') || plainFlatten(node)
    replace(node, value.trim() ? `$${value.trim()}$` : '')
  })
  return changed
}

function formulaTextFromHtml(html) {
  if (!html || typeof html !== 'string' || !MATH_MARKER_RE.test(html)) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!replaceMathNodes(doc)) return null
  return wrapBareLatex(convertLatexText(replaceRawMathml(blockText(doc))))
}

function flattenHtmlToText(html) {
  if (!html || typeof html !== 'string') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll(ASSISTIVE_SEL).forEach((n) => n.remove())
  return blockText(doc).trim()
}

// HTML tersimpan / dari editor → raw $...$ (string in, string out).
// Dipakai juga sebagai guard agar DOM render tak pernah tinggal di editor.
export function stripMathToRaw(html) {
  if (!html || typeof html !== 'string') return html
  const decoded = ESCAPED_MATH_HINT_RE.test(html)
    ? String(html).replace(ESCAPED_MATHML_RE, (m) => decodeMatchEntities(m))
    : String(html)
  if (!MATH_MARKER_RE.test(decoded)) return html
  const doc = new DOMParser().parseFromString(decoded, 'text/html')
  if (!replaceMathNodes(doc)) return decoded
  return doc.body.innerHTML
}

export function hasPastedMath(html, text) {
  if (html && MATH_MARKER_RE.test(html)) return true
  const t = text || ''
  if (!t) return false
  if (RAW_MATHML_TAG_RE.test(t) || ESCAPED_MATH_HINT_RE.test(t)) return true
  if (t.match(DELIM_RE)) return true
  return BARE_CMD_RE.test(t)
}

export function extractPastedFormula(html, text) {
  const plain = text || ''
  let htmlCandidate = null
  if (html && MATH_MARKER_RE.test(html)) {
    const fromHtml = formulaTextFromHtml(html)
    if (fromHtml != null) {
      htmlCandidate = fromHtml
    } else {
      const flat = flattenHtmlToText(html)
      if (flat) htmlCandidate = wrapBareLatex(convertLatexText(replaceRawMathml(flat)))
    }
  }
  let plainCandidate = null
  if (plain) {
    const normalized = wrapBareLatex(convertLatexText(replaceRawMathml(plain)))
    if (normalized !== plain) plainCandidate = normalized
  }
  // HTML clipboard kadang hanya berisi prefix / render parsial (rumus
  // kepotong) sementara text/plain memuat sumber penuh — jangan buang
  // yang lengkap. Pilih kandidat terpanjang; seri → plain (sumber asli).
  if (htmlCandidate != null && plainCandidate != null) {
    return plainCandidate.length >= htmlCandidate.length ? plainCandidate : htmlCandidate
  }
  return htmlCandidate ?? plainCandidate
}

// Akhir run rumus telanjang: lacak depth brace; berhenti di spasi + kata
// biasa (kecuali perintah lain menyusul = satu wilayah rumus).
function findRunEnd(seg, start) {
  let i = start
  let depth = 0
  const n = seg.length
  while (i < n) {
    const ch = seg[i]
    if (ch === '\\') {
      const m = seg.slice(i).match(/^\\[a-zA-Z]+/)
      i += m ? m[0].length : Math.min(2, n - i)
      continue
    }
    if (ch === '{' || ch === '[') { depth++; i++; continue }
    if (ch === '}' || ch === ']') {
      if (depth > 0) { depth--; i++; continue }
      break
    }
    if (ch === '$') break
    if (/\s/.test(ch)) {
      let j = i
      while (j < n && /\s/.test(seg[j])) j++
      if (j >= n) break
      const rest = seg.slice(j)
      if (depth > 0 || /^\\|^[{[(^_]/.test(rest)) { i = j; continue }
      const ahead = rest
      const cmdIdx = ahead.search(BARE_CMD_RE)
      if (cmdIdx !== -1 && cmdIdx < 40) { i = j; continue }
      break
    }
    i++
  }
  let end = i
  while (end > start && /\s/.test(seg[end - 1])) end--
  if (depth === 0 && end > start && /[.?!;:,]/.test(seg[end - 1])) end--
  return end
}

function wrapBareSegment(seg) {
  let out = ''
  let rest = seg
  for (;;) {
    const idx = rest.search(BARE_CMD_RE)
    if (idx === -1) return out + rest
    const end = findRunEnd(rest, idx)
    if (end - idx < 3) {
      out += rest.slice(0, idx + 1)
      rest = rest.slice(idx + 1)
      continue
    }
    out += rest.slice(0, idx) + '$' + rest.slice(idx, end) + '$'
    rest = rest.slice(end)
  }
}

// Perintah telanjang di luar $...$ dibungkus inline $...$.
export function wrapBareLatex(text) {
  if (!text || typeof text !== 'string') return text
  if (!BARE_CMD_RE.test(text)) return text
  const parts = text.split(DELIM_RE)
  for (let k = 0; k < parts.length; k += 2) parts[k] = wrapBareSegment(parts[k])
  return parts.join('')
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
