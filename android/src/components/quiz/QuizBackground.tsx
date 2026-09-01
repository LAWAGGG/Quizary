import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../context/ThemeContext';

interface QuizBackgroundProps {
  children?: React.ReactNode;
  themeColor?: string;
  isQuizDesign?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function hexToRgb(hex: string) {
  const h = (hex || '#6C5CE7').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function getThemeGradientColors(hex?: string): [string, string, string] {
  const base = hex || '#6C5CE7';
  const c1 = mixHex(base, '#FFFFFF', 0.12);
  const c2 = base;
  const c3 = mixHex(base, '#000000', 0.32);
  return [c1, c2, c3];
}

export function QuizBackground({ children, themeColor, isQuizDesign }: QuizBackgroundProps) {
  const { colors, isDark } = useAppTheme();
  const accentColor = themeColor || '#3B82F6';

  if (isQuizDesign) {
    const gradientColors = getThemeGradientColors(accentColor);
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        {children}
      </LinearGradient>
    );
  }

  // Default Form Dot-Matrix pattern background
  const columns = 8;
  const rows = 14;
  const colSpacing = (SCREEN_WIDTH - 40) / (columns - 1);
  const rowSpacing = (SCREEN_HEIGHT - 60) / (rows - 1);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : colors.bg }]}>
      {/* Background Dot Matrix Pattern */}
      <View style={styles.absoluteFill} pointerEvents="none">
        {Array.from({ length: rows }).map((_, r) => (
          <View key={`row-${r}`} style={styles.gridRow}>
            {Array.from({ length: columns }).map((_, c) => (
              <View
                key={`dot-${r}-${c}`}
                style={[
                  styles.bgDot,
                  {
                    left: 20 + c * colSpacing,
                    top: 30 + r * rowSpacing,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              />
            ))}
          </View>
        ))}

        {/* Top-Left Accent Dot Element */}
        <View style={styles.topLeftAccent}>
          <View style={[styles.outerRing, { borderColor: accentColor + '60' }]}>
            <View style={[styles.innerDot, { backgroundColor: accentColor }]} />
          </View>
        </View>

        {/* Bottom-Right Staircase/Triangular Dot Cluster */}
        <View style={styles.bottomRightCluster}>
          <View style={styles.clusterRow}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
          <View style={styles.clusterRow}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
          <View style={styles.clusterRow}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
          <View style={styles.clusterRow}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
        </View>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
  gridRow: { position: 'absolute' },
  bgDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  topLeftAccent: { position: 'absolute', top: 50, left: 20 },
  outerRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  innerDot: { width: 6, height: 6, borderRadius: 3 },
  bottomRightCluster: { position: 'absolute', bottom: 30, right: 20, alignItems: 'flex-end', gap: 6 },
  clusterRow: { flexDirection: 'row', gap: 6 },
  activeDot: { width: 5, height: 5, borderRadius: 2.5 },
});
