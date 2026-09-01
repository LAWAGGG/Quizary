import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, PanResponder, Animated, StyleSheet, ScrollView, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface PinchZoomContainerProps {
  children: React.ReactNode;
}

export function PinchZoomContainer({ children }: PinchZoomContainerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();

  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const [scaleNum, setScaleNum] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  const lastScale = useRef(1);
  const lastPan = useRef({ x: 0, y: 0 });

  // Update scale helper
  const changeScale = (newScale: number) => {
    const clampedScale = Math.max(1, Math.min(newScale, 2.5));
    lastScale.current = clampedScale;
    setScaleNum(clampedScale);

    Animated.spring(scale, {
      toValue: clampedScale,
      useNativeDriver: true,
      friction: 7,
    }).start();

    if (clampedScale === 1) {
      lastPan.current = { x: 0, y: 0 };
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }).start();
    }
  };

  const handleZoomIn = () => changeScale(scaleNum + 0.25);
  const handleZoomOut = () => changeScale(scaleNum - 0.25);
  const handleResetZoom = () => changeScale(1);

  // PanResponder for 1-finger drag when zoomed in
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => lastScale.current > 1.05,
      onStartShouldSetPanResponderCapture: () => lastScale.current > 1.05,
      onMoveShouldSetPanResponder: () => lastScale.current > 1.05,
      onMoveShouldSetPanResponderCapture: () => lastScale.current > 1.05,

      onPanResponderGrant: () => {
        if (lastScale.current > 1.05) {
          pan.setOffset({ x: lastPan.current.x, y: lastPan.current.y });
          pan.setValue({ x: 0, y: 0 });
        }
      },

      onPanResponderMove: (_, gestureState) => {
        if (lastScale.current > 1.05) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },

      onPanResponderRelease: () => {
        pan.flattenOffset();
        // @ts-ignore
        const currentPanX = pan.x._value || 0;
        // @ts-ignore
        const currentPanY = pan.y._value || 0;
        lastPan.current = { x: currentPanX, y: currentPanY };
      },

      onPanResponderTerminate: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && (contentHeight === 0 || Math.abs(h - contentHeight) > 50)) {
      setContentHeight(h);
    }
  };

  const extraBottomPadding = scaleNum > 1
    ? (contentHeight > 0 ? contentHeight * (scaleNum - 1) : 400) + (150 * (scaleNum - 1))
    : 0;

  const containerWidth = Math.min(windowWidth - 32, 600);

  return (
    <View style={styles.wrapper}>
      {/* Zoom Control Buttons Bar */}
      <View style={[styles.controlBar, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: colors.cardBorder }]}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
          onPress={handleZoomOut}
          disabled={scaleNum <= 1}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={18} color={scaleNum <= 1 ? colors.textMuted : colors.text} />
        </TouchableOpacity>

        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: colors.text }]}>{Math.round(scaleNum * 100)}%</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
          onPress={handleZoomIn}
          disabled={scaleNum >= 2.5}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={scaleNum >= 2.5 ? colors.textMuted : colors.text} />
        </TouchableOpacity>

        {scaleNum > 1 && (
          <TouchableOpacity style={[styles.resetBtn, { backgroundColor: colors.primary }]} onPress={handleResetZoom} activeOpacity={0.7}>
            <Ionicons name="refresh" size={14} color="#FFF" />
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Draggable & Scalable Content Container */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          alignItems: 'center',
          paddingBottom: 60 + extraBottomPadding,
        }}
        showsVerticalScrollIndicator={true}
        scrollEnabled={scaleNum <= 1.05}
      >
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={handleLayout}
          style={{
            width: containerWidth,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scale },
            ],
            transformOrigin: 'top center',
          }}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 46,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  resetBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
