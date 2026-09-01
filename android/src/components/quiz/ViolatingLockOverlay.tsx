import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  cheatReason?: string | null;
  lockedAt?: number; // timestamp ms when locked
  onRefresh: () => void;
  refreshing?: boolean;
}

function formatMMSS(ms: number) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ViolatingLockOverlay({ visible, cheatReason, lockedAt, onRefresh, refreshing }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  // Auto-finalize 5 menit dari lockedAt
  const AUTO_FINALIZE_MS = 5 * 60 * 1000;
  const remaining = lockedAt ? Math.max(0, AUTO_FINALIZE_MS - (now - lockedAt)) : AUTO_FINALIZE_MS;
  const timeStr = formatMMSS(remaining);

  return (
    <View style={styles.overlay}>
      <View style={styles.iconBox}>
        <Ionicons name="warning-outline" size={32} color="#EF4444" />
      </View>

      <Text style={styles.title}>You have been detected{'\n'}violating the rules</Text>

      <Text style={styles.reason}>Last violation: {cheatReason || 'window-blur'}</Text>

      <Text style={styles.desc}>
        Exam is temporarily locked. Your answers are saved and will be reviewed by the proctor. Do not close this page.
      </Text>

      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>AUTO-FINALIZE IN</Text>
        <Text style={styles.timerValue}>{timeStr}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={onRefresh} disabled={!!refreshing} activeOpacity={0.9}>
        {refreshing ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <>
            <Ionicons name="refresh" size={18} color="#0F172A" />
            <Text style={styles.btnText}>Periksa status terbaru</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A', // matches Image 2 dark #1E293B family
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  reason: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 10 },
  desc: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 340,
  },
  timerBox: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 160,
  },
  timerLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  timerValue: { color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 1, marginTop: 4, fontVariant: ['tabular-nums'] as any },
  btn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  btnText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
});
