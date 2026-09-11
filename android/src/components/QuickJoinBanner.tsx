import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppAlert } from '../context/AlertContext';
import { extractQuizToken } from '../app/(tabs)/join';
import { getPublicForm } from '../services/api_service';

export function QuickJoinBanner() {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const { showAlert } = useAppAlert();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleQuickJoin = async () => {
    const clean = extractQuizToken(joinCode);
    if (!clean) {
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Link / Kode Kosong' : 'Empty Link / Code',
        message: language === 'ID' ? 'Tempelkan link kuis atau masukkan kode terlebih dahulu.' : 'Paste a quiz link or enter a code first.',
      });
      return;
    }
    setJoining(true);
    try {
      const quiz = await getPublicForm(clean);
      setJoinCode('');
      router.push({ pathname: '/quiz', params: { shortCode: clean, formId: String(quiz.id) } });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Gagal Gabung' : 'Failed to Join',
        message: e.message || (language === 'ID' ? 'Link atau kode kuis tidak ditemukan.' : 'Quiz link or code not found.'),
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.bannerCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={[styles.topAccent, { backgroundColor: colors.primary }]} />
      <View style={styles.bannerRow}>
        <View style={[styles.bannerIconBox, { backgroundColor: isDark ? '#1E293B' : '#F5F3FF', borderColor: isDark ? '#334155' : '#DDD6FE', borderWidth: 1 }]}>
          <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary, fontSize: 10 * fontSizeScale }]}>{language === 'ID' ? 'CEPAT' : 'QUICK'}</Text>
          <Text style={[styles.bannerTitle, { color: colors.text, fontSize: 15 * fontSizeScale }]}>
            {language === 'ID' ? 'Gabung Kuis Baru' : 'Join New Quiz'}
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
            {language === 'ID' ? 'Scan QR Code atau tempel link kuis.' : 'Scan QR Code or paste a quiz link.'}
          </Text>
        </View>
      </View>

      {/* Quick Input Row */}
      <View style={styles.quickJoinRow}>
        <TextInput
          style={[styles.quickInput, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.inputBorder, fontSize: 13 * fontSizeScale }]}
          placeholder={language === 'ID' ? 'Tempel link atau kode kuis...' : 'Paste link or quiz code...'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          value={joinCode}
          onChangeText={setJoinCode}
        />
        <TouchableOpacity
          style={[styles.quickJoinBtn, { backgroundColor: colors.primary }, joining && { opacity: 0.6 }]}
          onPress={handleQuickJoin}
          disabled={joining}
        >
          {joining ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="arrow-forward" size={20} color="#FFF" />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.scanLauncherBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
        onPress={() => router.push('/(tabs)/join')}
        activeOpacity={0.8}
      >
        <Ionicons name="camera-outline" size={18} color={colors.primary} />
        <Text style={[styles.scanLauncherText, { color: colors.primary, fontSize: 13 * fontSizeScale }]}>
          {language === 'ID' ? 'Buka Kamera Scan QR Code' : 'Open QR Code Scanner'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.9 },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  bannerIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  eyebrow: { fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  bannerTitle: { fontWeight: '700', letterSpacing: -0.2 },
  bannerSub: { marginTop: 2, lineHeight: 16 },
  quickJoinRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickInput: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  quickJoinBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scanLauncherBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  scanLauncherText: { fontWeight: 'bold' },
});
