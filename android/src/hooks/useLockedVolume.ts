import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

let VolumeManager: any = null;
try {
  VolumeManager = require('react-native-volume-manager');
  // some versions export default
  if (VolumeManager?.default) VolumeManager = VolumeManager.default;
} catch {}

export function useLockedVolume() {
  const originalRef = useRef<number | null>(null);
  const listenerRef = useRef<any>(null);
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
          // v may be { volume: 0.5 } or number
          if (typeof v === 'number') originalRef.current = v;
          else if (v?.volume !== undefined) originalRef.current = v.volume;
        }
      } catch {}
      lockedRef.current = true;
      await VolumeManager.setVolume(1.0, { showUI: false, type: 'media' });
      // Lock: re-apply when user presses hardware keys
      try {
        if (VolumeManager.addVolumeListener) {
          listenerRef.current = VolumeManager.addVolumeListener(async (res: any) => {
            if (!lockedRef.current) return;
            const cur = typeof res === 'number' ? res : res?.volume;
            if (cur !== undefined && cur < 0.99) {
              try {
                await VolumeManager.setVolume(1.0, { showUI: false, type: 'media' });
              } catch {}
            }
          });
        } else if (VolumeManager.addListener) {
          listenerRef.current = VolumeManager.addListener('volumeChanged', async (res: any) => {
            if (!lockedRef.current) return;
            try {
              await VolumeManager.setVolume(1.0, { showUI: false, type: 'media' });
            } catch {}
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
        await VolumeManager.setVolume(originalRef.current, { showUI: false, type: 'media' });
      }
    } catch (e) {
      console.warn('[LockedVolume] restore failed', e);
    }
    originalRef.current = null;
  }, []);

  return { lock, unlock, isLocked: () => lockedRef.current };
}
