import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LockOverlayProps {
  onRefresh: () => void;
  isChecking: boolean;
  reason?: string;
  language?: string;
}

export default function LockOverlay({
  onRefresh,
  isChecking,
  reason = 'window-blur',
  language = 'ID',
}: LockOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 minute auto-finalize countdown

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.contentContainer}>
        {/* Red Warning Icon Container */}
        <View style={styles.iconBox}>
          <Ionicons name="warning-outline" size={36} color="#EF4444" />
        </View>

        {/* Title */}
        <Text style={styles.title}>You have been detected violating the rules</Text>

        {/* Subtitle / Violation Reason */}
        <Text style={styles.reasonText}>Last violation: {reason}</Text>

        {/* Description */}
        <Text style={styles.description}>
          Exam is temporarily locked. Your answers are saved and will be reviewed by the proctor. Do not close this page.
        </Text>

        {/* Auto-Finalize Box */}
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>AUTO-FINALIZE IN</Text>
          <Text style={styles.countdownValue}>{formatCountdown(secondsLeft)}</Text>
        </View>

        {/* Check Status Button */}
        <TouchableOpacity
          style={[styles.refreshButton, isChecking && styles.buttonDisabled]}
          onPress={onRefresh}
          disabled={isChecking}
          activeOpacity={0.85}
        >
          {isChecking ? (
            <ActivityIndicator color="#0F172A" size="small" />
          ) : (
            <View style={styles.buttonRow}>
              <Ionicons name="refresh-outline" size={18} color="#0F172A" />
              <Text style={styles.refreshButtonText}>
                {language === 'ID' ? 'Periksa status terbaru' : 'Check latest status'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#131b2e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  reasonText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  countdownBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 28,
    width: '75%',
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButtonText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 15,
  },
});