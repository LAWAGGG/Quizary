import { useCallback, useEffect } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

type AppPinningNative = {
  hasOverlay: () => Promise<boolean>;
  isInPipMode: () => Promise<boolean>;
  hasWindowFocus: () => Promise<boolean>;
  setSecureFlag: (enable: boolean) => Promise<boolean>;
};

function getNative(): AppPinningNative | null {
  if (Platform.OS !== 'android') return null;
  const m = (NativeModules as any).AppPinning as AppPinningNative | undefined;
  return m ?? null;
}

export function useFloatingBlock(onOverlayDetected?: (reason: string) => void) {
  // Disabled 3rd party floating overlay detector listener to prevent false positive locks
  // when opening modals, zoom, refresh, date pickers, or changing sections.
  useEffect(() => {
    return;
  }, [onOverlayDetected]);

  const hasFloating = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  const setSecure = useCallback(async (enable: boolean) => {
    const native = getNative();
    if (!native?.setSecureFlag) return;
    try {
      await native.setSecureFlag(enable);
    } catch {}
  }, []);

  return { hasFloating, setSecure };
}

