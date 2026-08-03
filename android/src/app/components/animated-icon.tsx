import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/**
 * AnimatedSplashOverlay
 * Fades out after the app is ready, then hides the native splash screen.
 */
export function AnimatedSplashOverlay() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Wait a moment, then fade out the overlay and hide the native splash.
    const timeout = setTimeout(async () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(async () => {
        await SplashScreen.hideAsync();
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} pointerEvents="none">
      <View style={styles.logoBox}>
        <Animated.Text style={styles.logoText}>Q</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
