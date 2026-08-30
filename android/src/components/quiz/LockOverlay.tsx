import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface LockOverlayProps {
  onRefresh: () => void;
  isChecking: boolean;
}

export default function LockOverlay({ onRefresh, isChecking }: LockOverlayProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Akses Terkunci!</Text>
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#334155',
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#ef4444', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
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