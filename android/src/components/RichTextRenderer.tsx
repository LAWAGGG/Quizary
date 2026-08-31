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

export function RichTextRenderer({ html, style, numberOfLines }: RichTextRendererProps) {
  const { colors, isDark } = useAppTheme();
  const [webViewHeight, setWebViewHeight] = useState<number>(45);

  if (!html) return null;

  const isMath = hasMathFormulas(html);

  // Extract fontSize and color from passed style if available
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const textColor = (flattenedStyle.color as string) || colors.text;
  const fontSize = (flattenedStyle.fontSize as number) || 14;

  if (isMath) {
    const katexHtml = `
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
          body, html {
            margin: 0;
            padding: 0;
            background-color: transparent;
            color: ${textColor};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: ${fontSize}px;
            line-height: 1.5;
            overflow: hidden;
            word-break: break-word;
          }
          p { margin: 0 0 6px 0; }
          p:last-child { margin-bottom: 0; }
          .katex-display {
            margin: 8px 0;
            overflow-x: auto;
            overflow-y: hidden;
          }
          .katex { font-size: 1.12em; color: ${textColor}; }
          img { max-width: 100%; height: auto; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div id="content">${html}</div>
        <script>
          function sendHeight() {
            var h = Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
              document.getElementById('content').offsetHeight
            );
            if (window.ReactNativeWebView && h > 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HEIGHT_CHANGE', height: h }));
            }
          }

          try {
            var formulas = document.querySelectorAll('.ql-formula');
            formulas.forEach(function(el) {
              var tex = el.getAttribute('data-value');
              if (tex && window.katex) {
                try { window.katex.render(tex, el, { throwOnError: false }); } catch(e) {}
              }
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
                throwOnError: false,
                strict: false
              });
            }
          } catch(e) {}

          sendHeight();
          setTimeout(sendHeight, 100);
          setTimeout(sendHeight, 300);
          setTimeout(sendHeight, 800);
        </script>
      </body>
      </html>
    `;

    return (
      <View style={{ height: Math.max(webViewHeight, 30), width: '100%' }}>
        <WebView
          originWhitelist={['*']}
          source={{ html: katexHtml }}
          style={{ backgroundColor: 'transparent', flex: 1 }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'HEIGHT_CHANGE' && data.height) {
                setWebViewHeight(data.height + 4);
              }
            } catch (e) {}
          }}
        />
      </View>
    );
  }

  // Fast Native Text Rendering for non-math rich text
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
