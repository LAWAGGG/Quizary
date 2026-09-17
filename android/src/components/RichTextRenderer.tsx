import React, { useState } from 'react';
import { Text, View, TextStyle, StyleProp, StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppTheme } from '../context/ThemeContext';
import { KATEX_CSS, KATEX_JS, KATEX_AUTO_RENDER } from '../utils/katexInline';

const htmlCache = new Map<string, string>();

/**
 * Converts common TeX math syntax to clean, readable Unicode math symbols.
 * Used as a fallback for pure text headers, title previews, and notifications.
 */
export function convertMathToUnicode(text: string): string {
  if (!text) return '';
  return text
    // Replace \frac{a}{b} -> (a/b)
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
    // Replace \sqrt{x} -> √(x)
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt\s*([a-zA-Z0-9]+)/g, '√$1')
    // Replace \sum_{i=1}^{n} -> ∑(i=1..n) or ∑
    .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑($1..$2)')
    .replace(/\\sum_\{([^}]+)\}/g, '∑($1)')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\int/g, '∫')
    // Common TeX Greek letters & symbols
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\infty/g, '∞')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    // Superscripts ^2, ^3, ^n
    .replace(/\^2\b|\^\{2\}/g, '²')
    .replace(/\^3\b|\^\{3\}/g, '³')
    .replace(/\^1\b|\^\{1\}/g, '¹')
    .replace(/\^0\b|\^\{0\}/g, '⁰')
    .replace(/\^n\b|\^\{n\}/g, 'ⁿ')
    .replace(/\^x\b|\^\{x\}/g, 'ˣ')
    // Subscripts _0, _1, _i, _n
    .replace(/_0\b|_\{0\}/g, '₀')
    .replace(/_1\b|_\{1\}/g, '₁')
    .replace(/_2\b|_\{2\}/g, '₂')
    .replace(/_i\b|_\{i\}/g, 'ᵢ')
    .replace(/_n\b|_\{n\}/g, 'ₙ')
    .replace(/_x\b|_\{x\}/g, 'ₓ')
    // Clean raw delimiters
    .replace(/\$\$/g, ' ')
    .replace(/\$/g, '')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '');
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
    /\\frac|\\sqrt|\\sum|\\prod|\\int|\\alpha|\\beta|\\gamma|\\pi|\\theta|\\infty|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\$[^\$\n]+\$/.test(html)
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
  const [webViewHeight, setWebViewHeight] = useState<number>(30);

  if (!html) return null;

  const needsWebView = needsRichWebView(html);

  // Extract fontSize and color from passed style if available
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const textColor = (flattenedStyle.color as string) || colors.text;
  const fontSize = (flattenedStyle.fontSize as number) || 14;
  const fontWeight = (flattenedStyle.fontWeight as any) || '400';
  const textAlign = (flattenedStyle.textAlign as string) || 'left';
  const lineHeight = (flattenedStyle.lineHeight as number) || Math.round(fontSize * 1.45);

  if (needsWebView) {
    const richHtml = `
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
            background-color: transparent;
          }
          body {
            margin: 0; padding: 0;
            height: auto !important;
            min-height: 0 !important;
            background-color: transparent;
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
          .rich-text blockquote { border-left: 4px solid #6C5CE7; padding-left: 12px; margin: 0.4em 0; color: rgba(255,255,255,0.7); font-style: italic; }
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
        <div class="rich-text" id="content">${html}</div>
        <script>${KATEX_JS}</script>
        <script>${KATEX_AUTO_RENDER}</script>
        <script>
          function sendHeight() {
            var el = document.getElementById('content');
            if (!el) return;
            var h = Math.ceil(el.offsetHeight || el.scrollHeight || el.getBoundingClientRect().height);
            if (window.ReactNativeWebView && h > 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HEIGHT_CHANGE', height: h }));
            }
          }
          document.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target.tagName !== 'A') {
              target = target.parentElement;
            }
            if (target && target.href) {
              e.preventDefault();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_LINK', url: target.href }));
              }
            }
          });
          try {
            var formulas = document.querySelectorAll('.ql-formula');
            for (var i = 0; i < formulas.length; i++) {
              var el = formulas[i];
              var tex = el.getAttribute('data-value');
              if (tex && window.katex) {
                try {
                  el.innerHTML = window.katex.renderToString(tex, { throwOnError: false, displayMode: false });
                } catch(e) {}
              }
            }
            if (window.renderMathInElement) {
              window.renderMathInElement(document.body, {
                delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '\\[', right: '\\]', display: true},
                  {left: '\\(', right: '\\)', display: false},
                  {left: '$', right: '$', display: false}
                ],
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                ignoredClasses: ['ql-code-block', 'ql-code-block-container', 'ql-syntax'],
                throwOnError: false, strict: false
              });
            }
          } catch(e) {}
          sendHeight();
          setTimeout(sendHeight, 80);
          setTimeout(sendHeight, 300);
        </script>
      </body>
      </html>
    `;

    return (
      <View style={{ height: webViewHeight > 0 ? webViewHeight : 30, width: '100%', overflow: 'hidden' }}>
        <WebView
          originWhitelist={['*']}
          source={{ html: richHtml }}
          style={{ backgroundColor: 'transparent', flex: 1 }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'HEIGHT_CHANGE' && data.height) {
                setWebViewHeight(data.height + 4);
              } else if (data.type === 'OPEN_LINK' && data.url) {
                Linking.openURL(data.url).catch(() => {});
              }
            } catch (e) {}
          }}
        />
      </View>
    );
  }

  // Fast Native Text Rendering for inline HTML (bold, italic, underline, links, etc)
  return <SimpleNativeHtml html={html} style={style} numberOfLines={numberOfLines} />;
}

