import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

interface RichTextRendererProps {
  html: string;
  style?: any;
}

export function RichTextRenderer({ html, style }: RichTextRendererProps) {
  const { colors } = useAppTheme();

  if (!html) return null;

  // If input doesn't contain HTML tags, render as plain text
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return <Text style={[{ color: colors.text, fontSize: 14, lineHeight: 22 }, style]}>{html}</Text>;
  }

  // Basic HTML normalization & cleanup
  const cleaned = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/ul>|<\/ol>/gi, '\n')
    .replace(/<ul[^>]*>|<ol[^>]*>/gi, '')
    .replace(/<blockquote[^>]*>/gi, '"')
    .replace(/<\/blockquote>/gi, '"\n');

  // Strip remaining HTML tags for clean text rendering
  const textContent = cleaned.replace(/<[^>]*>?/gm, '').trim();

  return (
    <Text style={[{ color: colors.text, fontSize: 14, lineHeight: 22 }, style]}>
      {textContent}
    </Text>
  );
}
