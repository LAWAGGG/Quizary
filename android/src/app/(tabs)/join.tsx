import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getPublicForm } from '../services/api_service';

export default function JoinScreen() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);

  const handleJoin = async (targetToken: string) => {
    const cleanToken = targetToken.trim();
    if (!cleanToken) {
      Alert.alert('Token Kosong', 'Silakan masukkan kode/token kuis terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const quiz = await getPublicForm(cleanToken);
      router.push({ pathname: '/(tabs)/quiz', params: { shortCode: cleanToken, formId: String(quiz.id) } });
    } catch (e: any) {
      Alert.alert('Gagal Gabung', e.message || 'Token kuis tidak valid atau kuis belum dipublikasikan.');
    } finally {
      setLoading(false);
    }
  };

  const onBarCodeScanned = async (data: string) => {
    if (!scanning) return;
    setScanning(false);
    setToken(data);
    await handleJoin(data);
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (p.granted) setScanning(true);
      else Alert.alert('Izin Kamera', 'Izin kamera dibutuhkan untuk memindai QR Code kuis.');
    } else {
      setScanning(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mode Responden (Student)</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="qr-code-outline" size={48} color="#3B82F6" />
        </View>

        <Text style={styles.title}>Masuk ke Kuis</Text>
        <Text style={styles.subtitle}>Masukkan 6 digit kode kuis atau pindai QR Code dari pengawas/guru.</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Kode Kuis / Token</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: A1B2C3"
            placeholderTextColor="#475569"
            autoCapitalize="characters"
            value={token}
            onChangeText={setToken}
          />

          <TouchableOpacity
            style={[styles.joinBtn, loading && styles.disabledBtn]}
            onPress={() => handleJoin(token)}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="#FFF" />
                <Text style={styles.joinBtnText}>Gabung Kuis</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>atau</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={styles.scanBtn} onPress={startScan} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={20} color="#10B981" />
            <Text style={styles.scanBtnText}>Pindai QR Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fullscreen Scanner Modal Overlay */}
      {scanning && (
        <View style={StyleSheet.absoluteFillObject}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => onBarCodeScanned(data)}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerText}>Arahkan kamera ke QR Code Kuis</Text>
            <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
              <Text style={styles.cancelScanText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  topHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  iconCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  title: { color: '#FFF', fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  formGroup: { width: '100%', gap: 12 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#1E293B', color: '#FFF', padding: 16, borderRadius: 12,
    fontSize: 18, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  joinBtn: {
    backgroundColor: '#3B82F6', padding: 16, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
  },
  disabledBtn: { opacity: 0.6 },
  joinBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: '#1E293B' },
  orText: { color: '#64748B', fontSize: 13 },
  scanBtn: {
    borderWidth: 2, borderColor: '#10B981', padding: 14, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  scanBtnText: { color: '#10B981', fontWeight: 'bold', fontSize: 15 },
  scannerOverlay: {
    position: 'absolute', bottom: 60, left: 20, right: 20,
    alignItems: 'center', gap: 16,
  },
  scannerText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  cancelScanBtn: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 25 },
  cancelScanText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
