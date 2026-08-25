import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

interface QuizSubmittedStepProps {
  resultData: any;
}

export function QuizSubmittedStep({ resultData }: QuizSubmittedStepProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <SafeAreaView style={[styles.centerScreen, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.successCircle, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
      </View>

      <Text style={[styles.successTitle, { color: colors.text }]}>Jawaban Terkirim! 🎉</Text>
      <Text style={[styles.successDesc, { color: colors.textSub }]}>
        Terima kasih telah mengisi kuis/form ini. Jawaban Anda telah berhasil tersimpan.
      </Text>

      {resultData?.score !== undefined && resultData?.score !== null && (
        <View style={[styles.resultScoreCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.resultScoreLabel, { color: colors.textSub }]}>Nilai Anda</Text>
          <Text style={[styles.resultScoreVal, { color: colors.primary }]}>{resultData.score}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.backHomeBtn, { backgroundColor: colors.primary }]}
        onPress={() => router.replace('/(tabs)/home')}
      >
        <Ionicons name="home-outline" size={18} color="#FFF" />
        <Text style={styles.backHomeBtnText}>Kembali ke Dashboard</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  successDesc: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  resultScoreCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center', marginBottom: 24, width: '100%' },
  resultScoreLabel: { fontSize: 13, fontWeight: '600' },
  resultScoreVal: { fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  backHomeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  backHomeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
