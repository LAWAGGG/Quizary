import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LockOverlayProps {
  onRefresh: () => void;
  isChecking: boolean;
}

// Kept for backward compat — new flows use ViolatingLockOverlay / RestrictedWarningOverlay
export default function LockOverlay({ onRefresh, isChecking }: LockOverlayProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Ionicons name="lock-closed" size={22} color="#94A3B8" />
        </View>
        <Text style={styles.title}>Akses terkunci</Text>
        <Text style={styles.subtitle}>
          Kamu terdeteksi meninggalkan aplikasi atau membuka bar notifikasi. Silakan minta creator/pengawas untuk membuka kembali akses ujianmu.
        </Text>

        <TouchableOpacity 
          style={[styles.button, isChecking && styles.buttonDisabled]} 
          onPress={onRefresh}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Cek Status (Refresh)</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', letterSpacing: -0.2, marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 19 },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});