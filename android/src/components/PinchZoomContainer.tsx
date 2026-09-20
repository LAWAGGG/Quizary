import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, PanResponder, Animated, StyleSheet, ScrollView, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface PinchZoomContainerProps {
  children: React.ReactNode;
}

export function PinchZoomContainer({ children }: PinchZoomContainerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useAppTheme();

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
      {/* Draggable & Scalable Content Container */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          alignItems: 'center',
          paddingBottom: 96 + extraBottomPadding,
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

      {/* Kontrol zoom floating kanan-bawah — paritas web ZoomModal (AnswerQuiz.jsx):
          ikon zoom-out, badge %, ikon zoom-in. Tap badge % = reset ke 100%. */}
      <View
        style={[
          styles.floatingPill,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.cardBorder,
            shadowColor: '#000',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.pillBtn}
          onPress={handleZoomOut}
          disabled={scaleNum <= 1}
          activeOpacity={0.7}
          accessibilityLabel="Zoom out question"
        >
          <FontAwesome name="search-minus" size={20} color={scaleNum <= 1 ? colors.textMuted : colors.textSub} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResetZoom}
          disabled={scaleNum <= 1}
          activeOpacity={0.7}
          accessibilityLabel="Reset zoom to 100 percent"
        >
          <Text style={[styles.badgeText, { color: colors.textSub }]}>{Math.round(scaleNum * 100)}%</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pillBtn}
          onPress={handleZoomIn}
          disabled={scaleNum >= 2.5}
          activeOpacity={0.7}
          accessibilityLabel="Zoom in question"
        >
          <FontAwesome name="search-plus" size={20} color={scaleNum >= 2.5 ? colors.textMuted : colors.textSub} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
  },
  floatingPill: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  pillBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    minWidth: 52,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
});
