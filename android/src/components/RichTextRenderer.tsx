import React, { useState, useEffect } from 'react';
import { Text, View, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppTheme } from '../context/ThemeContext';

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

function needsRichWebView(html: string): boolean {
  if (hasMathFormulas(html)) return true;
  // ONLY use WebView for math formulas, code blocks, tables, or images that cannot be rendered with native Text
  return /<(pre|code|table|img)[\s>]/i.test(html)
    || /class="[^"]*ql-(code-block|syntax)/i.test(html);
}

export function RichTextRenderer({ html, style, numberOfLines }: RichTextRendererProps) {
  const { colors, isDark } = useAppTheme();
  const [webViewHeight, setWebViewHeight] = useState<number>(45);

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
    // Mirrors frontend/src/index.css rich-text section (code block dark bg, inline code, lists, blockquote, katex, etc)
    const richHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
        <style>
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          html, body {
            margin: 0; padding: 0;
            background-color: transparent;
            color: ${textColor};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Google Sans Flex", sans-serif;
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            line-height: ${lineHeight}px;
            text-align: ${textAlign};
            overflow: hidden;
            word-break: break-word;
          }
          .rich-text { display: block; }
          .rich-text p { margin: 0; }
          .rich-text p + p { margin-top: 0.5em; }
          .rich-text a { color: #6C5CE7; text-decoration: underline; word-break: break-word; }
          .rich-text h1, .rich-text h2, .rich-text h3 { font-weight: 600; line-height: 1.3; margin: 0.6em 0 0.3em; }
          .rich-text h1 { font-size: 2em; } .rich-text h2 { font-size: 1.5em; } .rich-text h3 { font-size: 1.17em; }
          .rich-text blockquote { border-left: 4px solid rgba(108,92,231,0.4); padding-left: 16px; margin: 0.5em 0; }
          /* Code block — match frontend index.css dark #0f0f0f */
          .rich-text .ql-code-block-container, .rich-text pre.ql-syntax, .rich-text pre.ql-code-block, .rich-text div.ql-code-block {
            background: #0f0f0f !important; color: #f5f5f5 !important; border: 1px solid #27272a !important;
            border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 0.8125rem; line-height: 1.6; padding: 0.75rem 1rem; margin: 0.6em 0;
            white-space: pre-wrap; word-break: break-word; overflow-x: auto; tab-size: 4; display: block; text-align: left !important; width: 100%; box-sizing: border-box;
          }
          .rich-text .ql-code-block { background: transparent; border: none; padding: 0; margin: 0; border-radius: 0; white-space: pre-wrap; }
          .rich-text code { background: #0f0f0f !important; border: 1px solid #27272a !important; border-radius: 0.375rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85em; padding: 0.15em 0.4em; color: #f5f5f5 !important; word-break: break-word; }
          .rich-text pre code, .rich-text .ql-code-block code, .rich-text .ql-code-block-container code { background: transparent !important; border: none !important; padding: 0 !important; color: inherit !important; }
          /* Lists — match frontend */
          .rich-text ul, .rich-text ol { margin: 0.5em 0; padding-left: 0; }
          .rich-text li { list-style-type: none; padding-left: 1.5em; position: relative; margin: 0.15em 0; }
          .rich-text li::before { display: inline-block; margin-left: -1.5em; margin-right: 0.3em; text-align: right; width: 1.2em; }
          .rich-text ol { counter-reset: list-0; } .rich-text li[data-list="ordered"] { counter-increment: list-0; }
          .rich-text li[data-list="ordered"]::before { content: counter(list-0, decimal) '. '; }
          .rich-text li[data-list="bullet"]::before { content: '\\2022'; }
          .rich-text li[data-list="checked"]::before { content: '\\2611'; } .rich-text li[data-list="unchecked"]::before { content: '\\2610'; }
          .rich-text .ql-align-center { text-align: center; } .rich-text .ql-align-right { text-align: right; } .rich-text .ql-align-justify { text-align: justify; }
          .rich-text .katex-display { margin: 0.5em 0; overflow-x: auto; overflow-y: hidden; padding: 0.15em 0; }
          .rich-text .katex { font-size: 1.1em; color: ${textColor}; }
          .rich-text img { max-width: 100%; height: auto; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="rich-text" id="content">${html}</div>
        <script>
          function sendHeight() {
            var el = document.getElementById('content');
            var h = el ? Math.ceil(el.getBoundingClientRect().height) : 24;
            if (window.ReactNativeWebView && h > 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HEIGHT_CHANGE', height: h }));
            }
          }
          try {
            var formulas = document.querySelectorAll('.ql-formula');
            formulas.forEach(function(el) {
              var tex = el.getAttribute('data-value');
              if (tex && window.katex) { try { window.katex.render(tex, el, { throwOnError: false }); } catch(e) {} }
            });
            if (window.renderMathInElement) {
              window.renderMathInElement(document.body, {
                delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '\\[', right: '\\]', display: true},
                  {left: '\\(', right: '\\)', display: false},
                  {left: '$', right: '$', display: false}
                ],
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                throwOnError: false, strict: false
              });
            }
          } catch(e) {}
          sendHeight();
          setTimeout(sendHeight, 80);
          setTimeout(sendHeight, 300);
          setTimeout(sendHeight, 700);
        </script>
      </body>
      </html>
    `;

    return (
      <View style={{ height: Math.max(webViewHeight, 30), width: '100%' }}>
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
                setWebViewHeight(data.height + 6);
              }
            } catch (e) {}
          }}
        />
      </View>
    );
  }

  // Fast Native Text Rendering for simple HTML (single <p> etc)
  const textContent = stripHtmlTags(html);

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: colors.text, fontSize: 14, lineHeight: 22 }, style]}
    >
      {textContent}
    </Text>
  );
}
