import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

let VolumeManager: any = null;
try {
  VolumeManager = require('react-native-volume-manager');
  // some versions export default
  if (VolumeManager?.default) VolumeManager = VolumeManager.default;
} catch {}

const STREAM_TYPES = ['music', 'system', 'ring', 'alarm', 'notification', 'call'];

async function enforceMaxVolume() {
  if (!VolumeManager) return;
  for (const st of STREAM_TYPES) {
    try {
      await VolumeManager.setVolume(1.0, { showUI: false, type: st });
    } catch {}
  }
}

export function useLockedVolume() {
  const originalRef = useRef<number | null>(null);
  const listenerRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const lockedRef = useRef(false);

  const lock = useCallback(async () => {
    if (Platform.OS !== 'android' || lockedRef.current) return;
    if (!VolumeManager) {
      console.warn('[LockedVolume] VolumeManager not available');
      return;
    }
    try {
      // Save original
      try {
        if (VolumeManager.getVolume) {
          const v = await VolumeManager.getVolume();
          if (typeof v === 'number') originalRef.current = v;
          else if (v?.volume !== undefined) originalRef.current = v.volume;
        }
      } catch {}
      lockedRef.current = true;

      // Force max volume across all audio streams (music, system, ring, alarm, etc.)
      await enforceMaxVolume();

      // Continuous loop enforcement (every 150ms) to block hardware volume down even on lockscreen
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (lockedRef.current) {
          enforceMaxVolume().catch(() => {});
        }
      }, 150);

      // Listener enforcement: re-apply immediately when user presses hardware volume keys
      try {
        if (VolumeManager.addVolumeListener) {
          listenerRef.current = VolumeManager.addVolumeListener(async (res: any) => {
            if (!lockedRef.current) return;
            await enforceMaxVolume().catch(() => {});
          });
        } else if (VolumeManager.addListener) {
          listenerRef.current = VolumeManager.addListener('volumeChanged', async (res: any) => {
            if (!lockedRef.current) return;
            await enforceMaxVolume().catch(() => {});
          });
        }
      } catch {}
    } catch (e) {
      console.warn('[LockedVolume] lock failed', e);
    }
  }, []);

  const unlock = useCallback(async () => {
    if (!lockedRef.current) return;
    lockedRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (listenerRef.current) {
        try {
          if (listenerRef.current.remove) listenerRef.current.remove();
          else if (VolumeManager.removeVolumeListener) VolumeManager.removeVolumeListener(listenerRef.current);
        } catch {}
        listenerRef.current = null;
      }
    } catch {}

    try {
      if (VolumeManager && originalRef.current !== null) {
        for (const st of STREAM_TYPES) {
          try {
            await VolumeManager.setVolume(originalRef.current, { showUI: false, type: st });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[LockedVolume] restore failed', e);
    }
    originalRef.current = null;
  }, []);

  return { lock, unlock, isLocked: () => lockedRef.current };
}
