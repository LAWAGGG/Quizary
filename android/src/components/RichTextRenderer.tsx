import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Text, View, TextStyle, StyleProp, StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppTheme } from '../context/ThemeContext';
import { KATEX_CSS, KATEX_JS, KATEX_AUTO_RENDER } from '../utils/katexInline';

const htmlCache = new Map<string, string>();

function devLog(...args: any[]) {
  try {
    if ((globalThis as any).__DEV__) console.log('[RichText]', ...args);
  } catch {}
}

if ((globalThis as any).__DEV__) {
  devLog(`renderer loaded (es5-katex bundle ${KATEX_JS.length} chars)`);
}

// ── Maps untuk konversi LaTeX → Unicode ─────────────────────────────────────

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '−': '⁻', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ',
  'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'y': 'ʸ', 'z': 'ᶻ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '(': '₍', ')': '₎', '=': '₌', 'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ',
  'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ',
  'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
};

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  varpi: 'ϖ', rho: 'ρ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const SYMBOLS: Record<string, string> = {
  infty: '∞', times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥',
  neq: '≠', ne: '≠', approx: '≈', equiv: '≡', propto: '∝', sim: '∼', simeq: '≃', cong: '≅', subset: '⊂',
  supset: '⊃', subseteq: '⊆', supseteq: '⊇', in: '∈', notin: '∉', ni: '∋', cap: '∩', cup: '∪',
  varnothing: '∅', emptyset: '∅', wedge: '∧', vee: '∨', neg: '¬', land: '∧', lor: '∨',
  forall: '∀', exists: '∃', nexists: '∄', nabla: '∇', partial: '∂', ell: 'ℓ',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐',
  Leftrightarrow: '⇔', mapsto: '↦', implies: '⇒', gets: '←', uparrow: '↑', downarrow: '↓',
  dot: '·', cdots: '…', ldots: '…', vdots: '⋮', ddots: '⋱', prime: '′', circ: '∘', degree: '°',
  angle: '∠', triangle: '△', square: '□', checkmark: '✓', diamond: '◇', dagger: '†',
};

const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'coth',
  'arcsin', 'arccos', 'arctan', 'log', 'ln', 'lg', 'exp', 'det', 'dim', 'max', 'min', 'lim', 'gcd',
  'inf', 'sup', 'arg', 'deg', 'ker', 'Pr']);

/**
 * Reads a balanced { ... } group starting right after an opening brace.
 * Returns { text, end } where end = index just past the closing brace.
 */
function readBraced(s: string, i: number): { text: string; end: number } | null {
  if (i >= s.length || s[i] !== '{') return null;
  let depth = 0;
  let j = i;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { text: s.slice(i + 1, j), end: j + 1 };
    }
  }
  return null;
}

/**
 * Converts a raw LaTeX/KaTeX snippet to clean Unicode math symbols.
 * This is the fallback used by native Text rendering (titles, dropdowns,
 * notifications, and the math-safe fallback when WebView/KaTeX is unavailable).
 */
export function convertMathToUnicode(raw: string): string {
  if (!raw) return '';
  let s = String(raw);
  const out: string[] = [];
  let i = 0;
  const n = s.length;

  const pushUnicodeSub = (tok: string) => {
    const mapped = tok.split('').map((c) => SUBSCRIPTS[c] || '').join('');
    out.push(mapped || `_${tok}`);
  };
  const pushUnicodeSup = (tok: string) => {
    const mapped = tok.split('').map((c) => SUPERSCRIPTS[c] || '').join('');
    out.push(mapped || `^${tok}`);
  };

  while (i < n) {
    const c = s[i];

    if (c === '\\') {
      i++;
      if (i >= n) { out.push('\\'); break; }
      const d = s[i];

      // Escaped punctuation -> literal char
      if ('{}_$%#&'.includes(d)) { out.push(d); i++; continue; }
      if (d === ',') { out.push(' '); i++; continue; }
      if (d === ' ') { i++; continue; }
      if (d === '\\') { out.push('\n'); i++; continue; }
      if (d === '(' || d === '[') { i++; continue; } // \( \[ openers
      if (d === ')' || d === ']') { i++; continue; } // \) \] closers
      if (d === '.') { i++; continue; } // \left. \right.

      let cmd = '';
      while (i < n && /[A-Za-z@]/.test(s[i])) { cmd += s[i]; i++; }

      if (!cmd) { out.push('\\' + d); i++; continue; }

      if (cmd === 'left' || cmd === 'right') {
        // \left( \right) — keep the bracket char
        const b = s[i];
        i++;
        if (b === '(') out.push('(');
        else if (b === ')') out.push(')');
        else if (b === '[') out.push('[');
        else if (b === ']') out.push(']');
        else if (b === '{') out.push('{');
        else if (b === '}') out.push('}');
        else if (b === '|') out.push('|');
        continue;
      }

      if (cmd === 'quad' || cmd === 'qquad') { out.push(' '); continue; }
      if (cmd === 'hspace' || cmd === 'vspace' || cmd === 'vphantom' || cmd === 'hphantom') { i++; continue; }

      if (cmd === 'begin' || cmd === 'end') {
        const grp = readBraced(s, i);
        if (grp) i = grp.end;
        continue;
      }

      if (cmd === 'text') {
        const grp = readBraced(s, i);
        if (grp) { out.push(convertMathToUnicode(grp.text)); i = grp.end; }
        continue;
      }
      if (cmd === 'operatorname') {
        const grp = readBraced(s, i);
        if (grp) { out.push(grp.text); i = grp.end; }
        continue;
      }

      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        const a = readBraced(s, i);
        if (a) {
          const b = readBraced(s, a.end);
          if (b) {
            const num = convertMathToUnicode(a.text);
            const den = convertMathToUnicode(b.text);
            const wrapPart = (t: string) => (/[\s±+\-×÷·]/.test(t) ? `(${t})` : t);
            out.push(`(${wrapPart(num)}/${wrapPart(den)})`);
            i = b.end;
            continue;
          }
          i = a.end;
        }
        out.push('/');
        continue;
      }

      if (cmd === 'sqrt') {
        let index = null;
        if (s[i] === '[') {
          const close = s.indexOf(']', i);
          if (close > i) { index = s.slice(i + 1, close); i = close + 1; }
        }
        const grp = readBraced(s, i);
        if (grp) {
          out.push(index ? `${convertMathToUnicode(index)}√(${convertMathToUnicode(grp.text)})` : `√(${convertMathToUnicode(grp.text)})`);
          i = grp.end;
          continue;
        }
        // \sqrt x
        if (i < n && /[A-Za-z0-9]/.test(s[i])) { out.push(`√${s[i]}`); i++; continue; }
        out.push('√');
        continue;
      }

      if (cmd === 'sum' || cmd === 'prod' || cmd === 'int' || cmd === 'oint' || cmd === 'bigcup' || cmd === 'bigcap') {
        const symbol = cmd === 'sum' ? '∑' : cmd === 'prod' ? '∏' : cmd === 'int' ? '∫' : cmd === 'oint' ? '∮' : cmd === 'bigcup' ? '⋃' : '⋂';
        let sub = null, sup = null;
        if (s[i] === '_') {
          i++;
          const g = readBraced(s, i);
          if (g) { sub = convertMathToUnicode(g.text); i = g.end; }
        }
        if (s[i] === '^') {
          i++;
          const g = readBraced(s, i);
          if (g) { sup = convertMathToUnicode(g.text); i = g.end; }
        }
        if (sub || sup) out.push(`${symbol}[${sub || ''}..${sup || ''}]`);
        else out.push(symbol);
        continue;
      }

      if (cmd === 'vec') {
        const g = readBraced(s, i);
        if (g) { out.push(`${convertMathToUnicode(g.text)}→`); i = g.end; }
        continue;
      }
      if (cmd === 'bar' || cmd === 'overline') {
        const g = readBraced(s, i);
        if (g) {
          const t = convertMathToUnicode(g.text);
          out.push(t.length === 1 ? `${t}̄` : `(${t})̄`);
          i = g.end;
        }
        continue;
      }
      if (cmd === 'overrightarrow') {
        const g = readBraced(s, i);
        if (g) { out.push(`${convertMathToUnicode(g.text)}→`); i = g.end; }
        continue;
      }
      if (cmd === 'underline') {
        const g = readBraced(s, i);
        if (g) { out.push(convertMathToUnicode(g.text)); i = g.end; }
        continue;
      }
      if (cmd in GREEK) { out.push(GREEK[cmd]); continue; }
      if (cmd in SYMBOLS) { out.push(SYMBOLS[cmd]); continue; }
      if (FUNC_NAMES.has(cmd)) { out.push(cmd); continue; }
      if (cmd === 'limits') continue;

      // Unknown command: drop the backslash, keep name (e.g. \textbf{a} -> textbf)
      out.push(cmd);
      continue;
    }

    if (c === '^') {
      i++;
      const g = (i < n && s[i] === '{') ? readBraced(s, i) : null;
      if (g) { pushUnicodeSup(g.text); i = g.end; }
      else if (i < n) { pushUnicodeSup(s[i]); i++; }
      continue;
    }

    if (c === '_') {
      i++;
      const g = (i < n && s[i] === '{') ? readBraced(s, i) : null;
      if (g) { pushUnicodeSub(g.text); i = g.end; }
      else if (i < n) { pushUnicodeSub(s[i]); i++; }
      continue;
    }

    if (c === '&') { out.push(' '); i++; continue; }

    out.push(c);
    i++;
  }

  let result = out.join('');
  // Drop the remaining math delimiters ($...$, $$...$$) — keep the content.
  result = result.replace(/\$\$/g, '').replace(/\$/g, '');
  // Drop leftover TeX grouping braces (cosmetic only).
  result = result.replace(/[{}]/g, '');
  return result;
}

/**
 * Helper function to strip all HTML tags, decode common HTML entities,
 * and convert raw LaTeX formulas to readable unicode symbols for native Text components.
 */
export function stripHtmlTags(html?: string | null): string {
  if (!html || typeof html !== 'string') return '';
  if (htmlCache.has(html)) return htmlCache.get(html)!;

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/ul>|<\/ol>/gi, '\n')
    .replace(/<ul[^>]*>|<ol[^>]*>/gi, '')
    .replace(/<blockquote[^>]*>/gi, '"')
    .replace(/<\/blockquote>/gi, '"\n')
    .replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&lsquo;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&hellip;/gi, '...')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Convert raw TeX to unicode symbols so titles never show raw TeX commands
  text = convertMathToUnicode(text);

  const result = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  htmlCache.set(html, result);
  return result;
}

/**
 * Checks if an HTML or text string contains TeX math formulas or Quill formula tags.
 */
export function hasMathFormulas(html?: string | null): boolean {
  if (!html || typeof html !== 'string') return false;
  return (
    html.includes('$$') ||
    html.includes('\\[') ||
    html.includes('\\(') ||
    html.includes('ql-formula') ||
    html.includes('katex') ||
    html.includes('data-value') ||
    /\$[^\$\n]*\$/.test(html) ||
    /\\begin\{|\\frac|\\dfrac|\\tfrac|\\sqrt|\\sum|\\prod|\\int|\\oint|\\left|\\right|\\(alpha|beta|gamma|delta|epsilon|theta|pi|mu|lambda|sigma|phi|omega|Gamma|Delta|Theta|Lambda|Sigma|Phi|Omega|vec|bar|overline|times|div|cdot|pm|leq|geq|neq|approx|to|rightarrow|infty|notin|in\b)|\\operatorname|\\text\{/i.test(html)
  );
}

interface RichTextRendererProps {
  html?: string | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * Determines if an HTML string strictly requires a WebView browser context
 * (e.g. math formulas, code blocks, tables, embedded images/iframes).
 */
function needsRichWebView(html: string): boolean {
  if (!html || typeof html !== 'string') return false;
  if (hasMathFormulas(html)) return true;
  return /<(pre|code|table|img|iframe)[\s>]/i.test(html)
    || /class="[^"]*ql-(code-block|syntax|formula)/i.test(html);
}

/** Safe embed of arbitrary HTML as a JS string literal (escapes </script> etc). */
function jsLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function estimateWebViewHeight(html: string, fontSize: number, lineHeight: number): number {
  if (!html) return 30;
  const textLen = stripHtmlTags(html).length || html.length;
  const charsPerLine = Math.max(18, Math.floor(320 / Math.max(10, fontSize) * 1.85));
  const lines = Math.max(1, Math.ceil(textLen / charsPerLine));
  return Math.max(32, Math.min(420, Math.ceil(lines * lineHeight) + 12));
}

/**
 * Parses basic inline HTML tags (p, br, strong, b, em, i, u, s, strike, del, a, span)
 * into native React Native <Text> nodes without webview height gaps.
 */
function SimpleNativeHtml({
  html,
  style,
  numberOfLines,
}: {
  html: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useAppTheme();
  const flattenedStyle = StyleSheet.flatten(style) || {};

  const decodeEntities = (str: string) =>
    str
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/gi, "'")
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'");

  const parseNodes = (raw: string): React.ReactNode[] => {
    if (!raw) return [];

    const tagRegex = /<(p|br|strong|b|em|i|u|s|strike|del|a|span|code|h[1-6])([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>/gi;
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(raw)) !== null) {
      const textBefore = raw.substring(lastIdx, match.index);
      if (textBefore) {
        nodes.push(convertMathToUnicode(decodeEntities(textBefore.replace(/<[^>]*>/g, ''))));
      }

      const fullTag = match[0];
      const tag = (match[1] || '').toLowerCase();
      const attribs = match[2] || '';
      const content = match[3] || '';

      if (fullTag.toLowerCase().startsWith('<br')) {
        nodes.push('\n');
      } else {
        const children = parseNodes(content);
        const nodeStyle: TextStyle = {};

        if (tag === 'code' || attribs.includes('ql-font-monospace')) {
          nodeStyle.fontFamily = 'monospace';
        } else if (tag === 'strong' || tag === 'b') {
          nodeStyle.fontFamily = 'Poppins_700Bold';
          nodeStyle.fontWeight = '700';
        } else if (tag === 'em' || tag === 'i') {
          nodeStyle.fontFamily = 'Poppins_400Regular';
          nodeStyle.fontStyle = 'italic';
        } else if (tag === 'u') {
          nodeStyle.fontFamily = 'Poppins_400Regular';
          nodeStyle.textDecorationLine = 'underline';
        } else if (tag === 's' || tag === 'strike' || tag === 'del') {
          nodeStyle.fontFamily = 'Poppins_400Regular';
          nodeStyle.textDecorationLine = 'line-through';
        } else if (tag.startsWith('h')) {
          nodeStyle.fontFamily = 'Poppins_700Bold';
          nodeStyle.fontWeight = '700';
          const lvl = parseInt(tag.replace('h', ''), 10);
          nodeStyle.fontSize = Math.round((flattenedStyle.fontSize || 14) * (1.5 - lvl * 0.08));
        } else if (tag === 'a') {
          nodeStyle.fontFamily = 'Poppins_500Medium';
          nodeStyle.color = '#3B82F6';
          nodeStyle.textDecorationLine = 'underline';
          const hrefMatch = attribs.match(/href=["']([^"']+)["']/i);
          const url = hrefMatch ? hrefMatch[1] : null;

          nodes.push(
            <Text
              key={`a-${match.index}`}
              style={nodeStyle}
              onPress={() => {
                if (url) Linking.openURL(url).catch(() => {});
              }}
            >
              {children.length > 0 ? children : url || ''}
            </Text>
          );
          lastIdx = tagRegex.lastIndex;
          continue;
        }

        if (attribs.includes('ql-size-small')) nodeStyle.fontSize = 11;
        if (attribs.includes('ql-size-large')) nodeStyle.fontSize = 18;
        if (attribs.includes('ql-size-huge')) nodeStyle.fontSize = 24;

        nodes.push(
          <Text key={`tag-${match.index}`} style={nodeStyle}>
            {children}
          </Text>
        );
      }

      lastIdx = tagRegex.lastIndex;
    }

    const remaining = raw.substring(lastIdx);
    if (remaining) {
      nodes.push(convertMathToUnicode(decodeEntities(remaining.replace(/<[^>]*>/g, ''))));
    }

    return nodes;
  };

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: colors.text, fontSize: 14, lineHeight: 22 }, style]}
    >
      {parseNodes(html)}
    </Text>
  );
}

export function RichTextRenderer({ html, style, numberOfLines }: RichTextRendererProps) {
  const { colors } = useAppTheme();
  // Extract fontSize and color from passed style if available
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const textColor = (flattenedStyle.color as string) || colors.text;
  const fontSize = (flattenedStyle.fontSize as number) || 14;
  const fontWeight = (flattenedStyle.fontWeight as any) || '400';
  const textAlign = (flattenedStyle.textAlign as string) || 'left';
  const lineHeight = (flattenedStyle.lineHeight as number) || Math.round(fontSize * 1.45);
  const bgColor = ((flattenedStyle.backgroundColor as string) || 'transparent');

  const prevHtmlRef = useRef<string | null | undefined>(html);
  const needMath = hasMathFormulas(html);
  const needsWebView = needsRichWebView(html ?? '');

  const [webViewHeight, setWebViewHeight] = useState<number>(() => estimateWebViewHeight(html ?? '', fontSize, lineHeight));
  const [receivedHeight, setReceivedHeight] = useState(false);
  const [mathResolved, setMathResolved] = useState(!needMath);
  const [mathOk, setMathOk] = useState(!needMath);

  // Synchronous state adjustment during render when html prop changes (prevents 1-frame stale state bleed)
  if (prevHtmlRef.current !== html) {
    prevHtmlRef.current = html;
    setReceivedHeight(false);
    setWebViewHeight(estimateWebViewHeight(html ?? '', fontSize, lineHeight));
    setMathResolved(!needMath);
    setMathOk(!needMath);
  }

  // Batas waktu: bila WebView tak mengonfirmasi render matematika, pindah ke fallback native
  useEffect(() => {
    if (!needMath || mathResolved) return;
    const t = setTimeout(() => {
      if (!mathResolved) {
        devLog('math timeout -> native fallback');
        setMathResolved(true);
        setMathOk(false);
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [needMath, mathResolved]);

  // Page + source are memoized: Android reloads the WebView on every new
  // source object, so height/math state updates must not rebuild it.
  const richHtml = useMemo(() => {
    const contentLit = jsLiteral(html ?? '');
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>${KATEX_CSS}</style>
        <style>
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          html {
            margin: 0; padding: 0;
            height: auto !important;
            min-height: 0 !important;
            background-color: ${bgColor};
          }
          body {
            margin: 0; padding: 0;
            height: auto !important;
            min-height: 0 !important;
            background-color: ${bgColor};
            color: ${textColor};
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            line-height: ${lineHeight}px;
            text-align: ${textAlign};
            overflow: hidden;
            word-break: break-word;
            display: inline-block;
            width: 100%;
          }
          .rich-text { display: block; width: 100%; margin: 0; padding: 0; height: auto !important; }
          .rich-text p { margin: 0; padding: 0; }
          .rich-text p + p { margin-top: 0.4em; }
          .rich-text a { color: #3B82F6; text-decoration: underline; word-break: break-all; font-weight: 500; }
          .rich-text h1, .rich-text h2, .rich-text h3, .rich-text h4, .rich-text h5, .rich-text h6 { font-weight: 700; line-height: 1.3; margin: 0.4em 0 0.2em; color: inherit; }
          .rich-text h1 { font-size: 1.8em; } .rich-text h2 { font-size: 1.4em; } .rich-text h3 { font-size: 1.2em; }
          .rich-text strong, .rich-text b { font-weight: 700; }
          .rich-text em, .rich-text i { font-style: italic; }
          .rich-text u { text-decoration: underline; }
          .rich-text s, .rich-text strike, .rich-text del { text-decoration: line-through; }
          .rich-text sub { vertical-align: sub; font-size: 0.75em; }
          .rich-text sup { vertical-align: super; font-size: 0.75em; }
          .rich-text blockquote { border-left: 4px solid #6C5CE7; padding-left: 12px; margin: 0.4em 0; color: ${textColor}; font-style: italic; }
          .rich-text .ql-size-small { font-size: 0.75em; }
          .rich-text .ql-size-large { font-size: 1.35em; }
          .rich-text .ql-size-huge { font-size: 2.0em; }
          .rich-text .ql-font-serif { font-family: Georgia, Times, "Times New Roman", serif; }
          .rich-text .ql-font-monospace { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace; }
          .rich-text .ql-align-center { text-align: center; }
          .rich-text .ql-align-right { text-align: right; }
          .rich-text .ql-align-justify { text-align: justify; }
          /* Code block container & syntax */
          .rich-text .ql-code-block-container, .rich-text pre.ql-syntax, .rich-text pre.ql-code-block, .rich-text pre {
            background: #0f0f0f !important; color: #f5f5f5 !important; border: 1px solid #27272a !important;
            border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace;
            font-size: 0.85rem; line-height: 1.6; padding: 0.75rem 1rem; margin: 0.5em 0;
            white-space: pre-wrap; word-break: break-word; overflow-x: auto; tab-size: 4; display: block; text-align: left !important; width: 100%; box-sizing: border-box;
          }
          .rich-text .ql-code-block-container .ql-code-block, .rich-text div.ql-code-block {
            background: transparent !important; border: none !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; white-space: pre-wrap; display: block;
          }
          .rich-text .ql-code-block-container .ql-code-block + .ql-code-block { margin-top: 0; }
          .rich-text .ql-code-block .ql-ui { display: none !important; }
          .rich-text code { background: #0f0f0f !important; border: 1px solid #27272a !important; border-radius: 0.375rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85em; padding: 0.15em 0.4em; color: #f5f5f5 !important; word-break: break-word; }
          .rich-text pre code, .rich-text .ql-code-block code, .rich-text .ql-code-block-container code { background: transparent !important; border: none !important; padding: 0 !important; color: inherit !important; }
          /* Lists */
          .rich-text ul, .rich-text ol { margin: 0.4em 0; padding-left: 1.2em; }
          .rich-text li { margin: 0.2em 0; }
          .rich-text li[data-list="bullet"] { list-style-type: disc; }
          .rich-text li[data-list="ordered"] { list-style-type: decimal; }
          .rich-text .katex-display { margin: 0.4em 0; overflow-x: auto; overflow-y: hidden; padding: 0.1em 0; }
          .rich-text .katex { font-size: 1.1em; color: ${textColor}; }
          .rich-text img { max-width: 100%; height: auto; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="rich-text" id="content"></div>
        <script>${KATEX_JS}</script>
        <script>${KATEX_AUTO_RENDER}</script>
        <script>
          (function () {
            function post(type, data) {
              if (window.ReactNativeWebView) {
                var payload = { type: type };
                for (var k in data) payload[k] = data[k];
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
              }
            }
            function sendHeight() {
              var el = document.getElementById('content');
              if (!el) return;
              var h = Math.ceil(el.offsetHeight || el.scrollHeight || el.getBoundingClientRect().height);
              if (window.ReactNativeWebView && h > 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HEIGHT_CHANGE', height: h }));
              }
            }
            var content = document.getElementById('content');
            if (content) {
              content.innerHTML = ${contentLit};
            }
            var katexOk = typeof window.katex !== 'undefined' && window.katex;
            var autoOk = typeof window.renderMathInElement === 'function';
            post('MATH_READY', { katex: !!katexOk, auto: autoOk });
            try {
              if (katexOk) {
                var formulas = document.querySelectorAll('.ql-formula');
                for (var i = 0; i < formulas.length; i++) {
                  var el = formulas[i];
                  var tex = el.getAttribute('data-value');
                  if (tex) {
                    try { el.innerHTML = window.katex.renderToString(tex, { throwOnError: false, displayMode: false }); } catch (e) {}
                  }
                }
              }
              if (autoOk) {
                window.renderMathInElement(document.body, {
                  delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '\\\\[', right: '\\\\]', display: true},
                    {left: '\\\\(', right: '\\\\)', display: false},
                    {left: '$', right: '$', display: false}
                  ],
                  ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                  ignoredClasses: ['ql-code-block', 'ql-code-block-container', 'ql-syntax'],
                  throwOnError: false, strict: false
                });
              }
              var renderedCount = 0;
              try { renderedCount = document.querySelectorAll('#content .katex').length; } catch (e2) {}
              post('MATH_RENDERED', { ok: !!katexOk && autoOk, katex: !!katexOk, auto: autoOk, rendered: renderedCount });
            } catch (e) {
              post('MATH_RENDERED', { ok: false, katex: !!katexOk, auto: autoOk, error: String((e && e.message) || e) });
            }
            sendHeight();
            setTimeout(sendHeight, 120);
            setTimeout(sendHeight, 400);
            setTimeout(sendHeight, 900);
          })();
        </script>
      </body>
      </html>
    `;
  }, [html, bgColor, textColor, fontSize, fontWeight, lineHeight, textAlign]);
  const webViewSource = useMemo(() => ({ html: richHtml }), [richHtml]);

  if (!html) return null;

  // While pending we keep the WebView visible; only swap to native when it
  // reports failure (or times out).
  if (needsWebView && (mathOk || !mathResolved)) {
    return (
      <View style={{ height: (receivedHeight ? webViewHeight : estimateWebViewHeight(html, fontSize, lineHeight)), width: '100%', overflow: 'hidden', backgroundColor: bgColor }}>
        <WebView
          originWhitelist={['*']}
          source={webViewSource}
          style={{ backgroundColor: bgColor, flex: 1 }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'HEIGHT_CHANGE' && data.height && data.height > 0) {
                setWebViewHeight(data.height + 4);
                setReceivedHeight(true);
              } else if (data.type === 'OPEN_LINK' && data.url) {
                Linking.openURL(data.url).catch(() => {});
              } else if (data.type === 'MATH_RENDERED') {
                devLog('MATH_RENDERED ok=', !!data.ok, 'katex=', !!data.katex, 'rendered=', data.rendered);
                if (needMath) {
                  setMathResolved(true);
                  setMathOk(!!data.ok);
                }
              } else if (data.type === 'MATH_READY' && !data.katex) {
                devLog('MATH_READY katex missing -> native fallback');
                if (needMath) {
                  setMathResolved(true);
                  setMathOk(false);
                }
              }
            } catch (e) {}
          }}
        />
      </View>
    );
  }

  // Fast Native Text Rendering for inline HTML (bold, italic, underline, links, etc)
  // atau fallback math-safe bila WebView/KaTeX tidak siap
  return <SimpleNativeHtml html={html} style={style} numberOfLines={numberOfLines} />;
}