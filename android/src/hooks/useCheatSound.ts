import { useCallback } from 'react';
import { Platform } from 'react-native';

let useAudioPlayer: any = null;
let useAudioPlayerStatus: any = null;
try {
  const EA: any = require('expo-audio');
  useAudioPlayer = EA.useAudioPlayer;
  useAudioPlayerStatus = EA.useAudioPlayerStatus;
} catch {}

const CHEAT_SOUND = require('../assets/sounds/cheat-alert.mp3');

export function useCheatSound() {
  // expo-audio hook must be called unconditionally at top level
  const audioPlayer = useAudioPlayer ? useAudioPlayer(CHEAT_SOUND) : null;

  const play = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const p = audioPlayer;
      if (!p) return;
      try {
        if (p.volume !== undefined) p.volume = 1.0;
      } catch {}
      try {
        if (p.seekTo) await p.seekTo(0);
      } catch {}
      await p.play();
    } catch (e) {
      console.warn('[CheatSound] play failed', e);
    }
  }, [audioPlayer]);

  const stop = useCallback(async () => {
    try {
      const p = audioPlayer;
      if (!p) return;
      try {
        if (p.pause) await p.pause();
      } catch {}
      try {
        if (p.seekTo) await p.seekTo(0);
      } catch {}
    } catch {}
  }, [audioPlayer]);

  const release = useCallback(async () => {
    try {
      const p = audioPlayer;
      if (!p) return;
      try {
        if (p.pause) await p.pause();
      } catch {}
      try {
        if (p.remove) p.remove();
      } catch {}
    } catch {}
  }, [audioPlayer]);

  return { play, stop, release };
}
