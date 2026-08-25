import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { extractQuizToken } from '../app/(tabs)/join';
import { getPublicForm } from '../services/api_service';

export function QuickJoinBanner() {
  const { colors, isDark } = useAppTheme();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleQuickJoin = async () => {
    const clean = extractQuizToken(joinCode);
    if (!clean) {
      Alert.alert('Link / Kode Kosong', 'Tempelkan link kuis atau masukkan kode terlebih dahulu.');
      return;
    }
    setJoining(true);
    try {
      const quiz = await getPublicForm(clean);
      setJoinCode('');
      router.push({ pathname: '/quiz', params: { shortCode: clean, formId: String(quiz.id) } });
    } catch (e: any) {
      Alert.alert('Gagal Gabung', e.message || 'Link atau kode kuis tidak ditemukan.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.bannerCard, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF', borderColor: colors.cardBorder }]}>
      <View style={styles.bannerRow}>
        <View style={[styles.bannerIconBox, { backgroundColor: colors.primary }]}>
          <Ionicons name="qr-code-outline" size={24} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>Gabung Kuis Baru</Text>
          <Text style={[styles.bannerSub, { color: colors.textSub }]}>Scan QR Code atau tempel link kuis.</Text>
        </View>
      </View>

      {/* Quick Input Row */}
      <View style={styles.quickJoinRow}>
        <TextInput
          style={[styles.quickInput, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Tempel link atau kode kuis..."
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
        <Text style={[styles.scanLauncherText, { color: colors.primary }]}>Buka Kamera Scan QR Code</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 24 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  bannerIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: 'bold' },
  bannerSub: { fontSize: 12, marginTop: 2 },
  quickJoinRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickInput: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 13 },
  quickJoinBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scanLauncherBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  scanLauncherText: { fontWeight: 'bold', fontSize: 13 },
});
