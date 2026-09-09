import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Hook to track keyboard height & visibility.
 * - On Android with softwareKeyboardLayoutMode="resize", window resizes but
 *   we still provide height for extra bottom padding / scroll offset.
 * - Returns { keyboardHeight, isVisible }.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 280;
      setKeyboardHeight(h);
      setIsVisible(true);
    };
    const onHide = () => {
      setKeyboardHeight(0);
      setIsVisible(false);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const s1 = Keyboard.addListener(showEvent, onShow);
    const s2 = Keyboard.addListener(hideEvent, onHide);
    // Fallback listeners for cross-platform
    const s3 = Keyboard.addListener('keyboardDidShow', onShow);
    const s4 = Keyboard.addListener('keyboardDidHide', onHide);

    return () => {
      s1.remove();
      s2.remove();
      s3.remove();
      s4.remove();
    };
  }, []);

  return { keyboardHeight, isVisible };
}
