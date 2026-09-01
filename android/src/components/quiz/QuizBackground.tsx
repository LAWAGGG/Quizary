import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';

interface QuizBackgroundProps {
  children?: React.ReactNode;
  themeColor?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function QuizBackground({ children, themeColor }: QuizBackgroundProps) {
  const { colors, isDark } = useAppTheme();
  const accentColor = themeColor || '#3B82F6';

  // Generate grid points for background dot matrix pattern
  const columns = 8;
  const rows = 14;
  const colSpacing = (SCREEN_WIDTH - 40) / (columns - 1);
  const rowSpacing = (SCREEN_HEIGHT - 60) / (rows - 1);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : colors.bg }]}>
      {/* Background Dot Matrix Pattern */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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

        {/* Bottom-Right Staircase/Triangular Dot Cluster (Exact match with screenshot) */}
        <View style={styles.bottomRightCluster}>
          {/* Row 1: 4 dots */}
          <View style={styles.clusterRow}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
          {/* Row 2: 3 dots (aligned right) */}
          <View style={[styles.clusterRow, { justifyContent: 'flex-end' }]}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
          {/* Row 3: 2 dots (aligned right) */}
          <View style={[styles.clusterRow, { justifyContent: 'flex-end' }]}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
          {/* Row 4: 1 dot (bottom right) */}
          <View style={[styles.clusterRow, { justifyContent: 'flex-end' }]}>
            <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
          </View>
        </View>
      </View>

      {/* Main Content Layer */}
      <View style={{ flex: 1, zIndex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gridRow: { position: 'absolute' },
  bgDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  topLeftAccent: {
    position: 'absolute',
    top: 24,
    left: 20,
  },
  outerRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  bottomRightCluster: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    gap: 8,
    alignItems: 'flex-end',
  },
  clusterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
