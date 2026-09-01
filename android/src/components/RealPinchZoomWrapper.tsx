import React, { useRef } from 'react';
import { View, PanResponder } from 'react-native';

interface RealPinchZoomWrapperProps {
  children: React.ReactNode;
  onZoomChange: (newScale: number | ((prev: number) => number)) => void;
  currentScale: number;
}

export function RealPinchZoomWrapper({ children, onZoomChange, currentScale }: RealPinchZoomWrapperProps) {
  const initialDistance = useRef<number | null>(null);
  const startScale = useRef<number>(currentScale);

  const getDistance = (touches: any[]) => {
    const [t1, t2] = touches;
    if (!t1 || !t2) return 0;
    return Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,

      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          initialDistance.current = getDistance(evt.nativeEvent.touches);
          startScale.current = currentScale;
        }
      },

      onPanResponderMove: (evt) => {
        if (evt.nativeEvent.touches.length === 2 && initialDistance.current) {
          const dist = getDistance(evt.nativeEvent.touches);
          if (dist > 0 && initialDistance.current > 0) {
            const ratio = dist / initialDistance.current;
            let nextScale = startScale.current * ratio;
            // Limit scale between 1.0x (normal) and 2.0x (large)
            nextScale = Math.max(1.0, Math.min(nextScale, 2.0));
            onZoomChange(nextScale);
          }
        }
      },

      onPanResponderRelease: () => {
        initialDistance.current = null;
      },

      onPanResponderTerminate: () => {
        initialDistance.current = null;
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
