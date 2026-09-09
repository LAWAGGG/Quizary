import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export interface AnimatedScoreCircleProps {
  score: number;
  maxScore: number;
  ringColor: string;
  isDark: boolean;
  textColor: string;
  textSubColor: string;
  ready?: boolean;
  size?: number;
  strokeWidth?: number;
}

export default function AnimatedScoreCircle({
  score,
  maxScore,
  ringColor,
  isDark,
  textColor,
  textSubColor,
  ready = true,
  size = 140,
  strokeWidth = 10,
}: AnimatedScoreCircleProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  const targetScore = Math.round(score);
  const percentage = maxScore > 0 ? Math.min(100, Math.max(0, Math.round((targetScore / maxScore) * 100))) : 0;

  useEffect(() => {
    if (!ready) return;

    animatedValue.setValue(0);
    scaleAnim.setValue(0.6);
    opacityAnim.setValue(0);
    setDisplayScore(0);

    const listenerId = animatedValue.addListener(({ value }) => {
      const currentPct = Math.min(100, Math.max(0, value));
      const currentVal = percentage > 0
        ? Math.round((currentPct / percentage) * targetScore)
        : 0;
      setDisplayScore(currentVal);
    });

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: percentage,
        duration: 1200,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [percentage, targetScore, maxScore, ready]);

  const firstHalfRotate = animatedValue.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ['0deg', '180deg', '180deg'],
    extrapolate: 'clamp',
  });

  const secondHalfRotate = animatedValue.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ['0deg', '0deg', '180deg'],
    extrapolate: 'clamp',
  });

  const tipRotate = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'clamp',
  });

  const capOpacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 100],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  const trackColor = isDark ? '#223042' : '#E2E8F0';
  const halfSize = size / 2;
  const capSize = strokeWidth;
  const capRadius = capSize / 2;
  const capLeft = halfSize - capRadius;
  const innerSize = size - strokeWidth * 2;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* 1. Track Lingkaran Abu-abu (Selalu 360 derajat penuh di latar belakang) */}
      <View
        style={[
          styles.trackCircle,
          {
            width: size,
            height: size,
            borderRadius: halfSize,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {/* 2. Arc Progress Sebelah Kanan (0% - 50%, dari jam 12 ke jam 6) */}
      <View
        style={[
          styles.halfMask,
          {
            width: halfSize,
            height: size,
            left: halfSize,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fullCircleFrame,
            {
              width: size,
              height: size,
              left: -halfSize,
              transform: [{ rotate: firstHalfRotate }],
            },
          ]}
        >
          <View
            style={[
              styles.halfMask,
              {
                width: halfSize,
                height: size,
                left: 0,
              },
            ]}
          >
            <View
              style={[
                styles.coloredRing,
                {
                  width: size,
                  height: size,
                  borderRadius: halfSize,
                  borderWidth: strokeWidth,
                  borderColor: ringColor,
                  left: 0,
                },
              ]}
            />
          </View>
        </Animated.View>
      </View>

      {/* 3. Arc Progress Sebelah Kiri (50% - 100%, dari jam 6 ke jam 12) */}
      <View
        style={[
          styles.halfMask,
          {
            width: halfSize,
            height: size,
            left: 0,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fullCircleFrame,
            {
              width: size,
              height: size,
              left: 0,
              transform: [{ rotate: secondHalfRotate }],
            },
          ]}
        >
          <View
            style={[
              styles.halfMask,
              {
                width: halfSize,
                height: size,
                left: halfSize,
              },
            ]}
          >
            <View
              style={[
                styles.coloredRing,
                {
                  width: size,
                  height: size,
                  borderRadius: halfSize,
                  borderWidth: strokeWidth,
                  borderColor: ringColor,
                  left: -halfSize,
                },
              ]}
            />
          </View>
        </Animated.View>
      </View>

      {/* 4. Rounded Cap di Titik Mulai (Jam 12) */}
      <Animated.View
        style={[
          styles.startCapDot,
          {
            width: capSize,
            height: capSize,
            borderRadius: capRadius,
            left: capLeft,
            backgroundColor: ringColor,
            opacity: capOpacity,
          },
        ]}
      />

      {/* 5. Rounded Cap Bergerak di Ujung Progress */}
      <Animated.View
        style={[
          styles.tipRotator,
          {
            width: size,
            height: size,
            opacity: capOpacity,
            transform: [{ rotate: tipRotate }],
          },
        ]}
      >
        <View
          style={[
            styles.capDot,
            {
              width: capSize,
              height: capSize,
              borderRadius: capRadius,
              left: capLeft,
              backgroundColor: ringColor,
            },
          ]}
        />
      </Animated.View>

      {/* 6. Teks Nilai di Tengah Lingkaran */}
      <View
        style={[
          styles.innerContent,
          {
            width: innerSize,
            height: innerSize,
          },
        ]}
      >
        <Text style={[styles.scoreText, { color: textColor }]}>{displayScore}</Text>
        {maxScore > 0 && (
          <Text style={[styles.maxScoreText, { color: textSubColor }]}>/{Math.round(maxScore)}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  trackCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  halfMask: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  fullCircleFrame: {
    position: 'absolute',
    top: 0,
  },
  coloredRing: {
    position: 'absolute',
    top: 0,
  },
  startCapDot: {
    position: 'absolute',
    top: 0,
    zIndex: 5,
  },
  tipRotator: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 5,
  },
  capDot: {
    position: 'absolute',
    top: 0,
  },
  innerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  scoreText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  maxScoreText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: -2,
  },
});
