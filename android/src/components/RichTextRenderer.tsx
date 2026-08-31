import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

/**
 * Helper function to strip all HTML tags and decode common HTML entities.
 * Used to cleanly render rich text content from Quill editor in native React Native Text components.
 */
const htmlCache = new Map<string, string>();

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

  const result = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  htmlCache.set(html, result);
  return result;
}

interface RichTextRendererProps {
  html?: string | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function RichTextRenderer({ html, style, numberOfLines }: RichTextRendererProps) {
  const { colors } = useAppTheme();

  if (!html) return null;

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
