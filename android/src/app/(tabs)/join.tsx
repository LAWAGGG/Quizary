import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getPublicForm } from '../../services/api_service';
import { useAppTheme } from '../../context/ThemeContext';

export function extractQuizToken(input: string): string {
  let clean = (input || '').trim();
  if (!clean) return '';

  if (clean.includes('/q/')) {
    const parts = clean.split('/q/');
    clean = parts[parts.length - 1];
  } else if (clean.includes('/forms/')) {
    const parts = clean.split('/forms/');
    clean = parts[parts.length - 1];
  } else if (clean.includes('/quiz/')) {
    const parts = clean.split('/quiz/');
    clean = parts[parts.length - 1];
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    clean = parts[parts.length - 1];
  }

  return clean.split('?')[0].split('#')[0].replace(/\/$/, '').toUpperCase();
}

export default function JoinScreen() {
  const { colors, isDark } = useAppTheme();
  const [linkOrCode, setLinkOrCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);

  // Auto request camera permission and enable scanning on tab focus
  useFocusEffect(
    React.useCallback(() => {
      setIsScanning(true);
      if (!permission?.granted) {
        requestPermission();
      }
    }, [permission])
  );

  const handleJoin = async (inputStr: string) => {
    const token = extractQuizToken(inputStr);
    if (!token) {
      Alert.alert('Link / Kode Kosong', 'Silakan tempelkan link kuis atau masukkan kode terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const quiz = await getPublicForm(token);
      setIsScanning(false);
      setLinkOrCode('');
      router.push({ pathname: '/quiz', params: { shortCode: token, formId: String(quiz.id) } });
    } catch (e: any) {
      Alert.alert('Gagal Gabung', e.message || 'Link atau kode kuis tidak valid atau kuis belum dipublikasikan.');
      setIsScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const onBarCodeScanned = async (data: string) => {
    if (!isScanning || loading) return;
    setIsScanning(false);
    await handleJoin(data);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={[styles.topHeader, { borderBottomColor: colors.inputBorder }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]} onPress={() => router.push('/(tabs)/home')}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pindai QR / Masukkan Link</Text>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {/* Live Camera Scanner Box */}
        {permission?.granted ? (
          <View style={[styles.cameraContainer, { borderColor: colors.primary }]}>
            {isScanning ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => onBarCodeScanned(data)}
              />
            ) : (
              <View style={[styles.cameraPlaceholder, { backgroundColor: colors.cardBg }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSub, marginTop: 10, fontSize: 13 }}>Memproses Link Kuis...</Text>
              </View>
            )}

            {/* Scanner Frame Overlay */}
            {isScanning && (
              <View style={styles.scannerOverlay}>
                <View style={styles.scanTargetBox} />
                <Text style={styles.scannerHintText}>Arahkan kamera ke QR Code Kuis</Text>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={[styles.permCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]} onPress={requestPermission}>
            <Ionicons name="camera-outline" size={40} color={colors.primary} />
            <Text style={[styles.permTitle, { color: colors.text }]}>Aktifkan Izin Kamera</Text>
            <Text style={[styles.permSub, { color: colors.textSub }]}>Klik di sini untuk mengizinkan kamera memindai QR Code kuis secara otomatis.</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.inputBorder }]} />
          <Text style={[styles.orText, { color: colors.textMuted }]}>atau tempel link kuis</Text>
          <View style={[styles.line, { backgroundColor: colors.inputBorder }]} />
        </View>

        {/* Manual Link/Token Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Link / Short Code Kuis</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              placeholder="Tempel link kuis (mis. http://.../q/ABC123)"
              placeholderTextColor={colors.textMuted}
              value={linkOrCode}
              onChangeText={setLinkOrCode}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
              onPress={() => handleJoin(linkOrCode)}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="arrow-forward" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600' },

  content: { flex: 1, padding: 20, justifyContent: 'center' },

  cameraContainer: { height: 260, borderRadius: 20, overflow: 'hidden', borderWidth: 2, marginBottom: 20 },
  cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  scanTargetBox: { width: 180, height: 180, borderRadius: 16, borderWidth: 2, borderColor: '#10B981', backgroundColor: 'transparent' },
  scannerHintText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, marginTop: 14, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },

  permCard: { borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, marginBottom: 20, gap: 8 },
  permTitle: { fontSize: 16, fontWeight: 'bold' },
  permSub: { fontSize: 13, textAlign: 'center' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 10 },
  line: { flex: 1, height: 1 },
  orText: { fontSize: 12, fontWeight: '600' },

  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 13 },
  joinBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
