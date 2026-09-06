import { useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';

type AppPinningNative = {
  hasOverlay: () => Promise<boolean>;
  isInPipMode: () => Promise<boolean>;
  setSecureFlag: (enable: boolean) => Promise<boolean>;
};

function getNative(): AppPinningNative | null {
  if (Platform.OS !== 'android') return null;
  const m = (NativeModules as any).AppPinning as AppPinningNative | undefined;
  return m ?? null;
}

export function useFloatingBlock() {
  const hasFloating = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    const native = getNative();
    if (!native) return false;
    try {
      // Primary: PiP / multi-window via native
      if (native.isInPipMode) {
        const pip = await native.isInPipMode().catch(() => false);
        if (pip) return true;
      }
      if (native.hasOverlay) {
        const ov = await native.hasOverlay().catch(() => false);
        if (ov) return true;
      }
      return false;
    } catch {
      return false;
    }
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
