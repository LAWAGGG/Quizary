import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { RichTextRenderer } from '../RichTextRenderer';

interface QuizLandingStepProps {
  publicForm: any;
  starting: boolean;
  onStart: () => void;
}

export function QuizLandingStep({ publicForm, starting, onStart }: QuizLandingStepProps) {
  const { colors, isDark } = useAppTheme();
  const themeColor = publicForm?.theme_color || colors.primary;
  const qCount = publicForm?.question_count || 0;

  return (
    <SafeAreaView style={[styles.landingContainer, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Minimal Header */}
      <View style={styles.landingHeader}>
        <TouchableOpacity
          style={[styles.iconCircleBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Center Card */}
      <View style={styles.landingCenter}>
        <View style={[styles.cardContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          {publicForm?.banner_path && (
            <Image source={{ uri: publicForm.banner_path }} style={styles.landingBanner} />
          )}

          <Text style={[styles.quizTitle, { color: colors.text }]}>{publicForm?.title || 'Kuis'}</Text>

          {publicForm?.description ? (
            <View style={{ marginBottom: 16 }}>
              <RichTextRenderer html={publicForm.description} style={{ color: colors.textSub, fontSize: 14 }} />
            </View>
          ) : null}

          {/* Start Button */}
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: themeColor }]}
            onPress={onStart}
            disabled={starting}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="play-outline" size={20} color="#FFF" />
                <Text style={styles.startButtonText}>Mulai Kuis</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Question Count Badge */}
          <View style={[styles.pillBadge, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.pillBadgeText, { color: colors.textSub }]}>{qCount} Soal</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  landingContainer: { flex: 1 },
  landingHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  iconCircleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  landingCenter: { flex: 1, justifyContent: 'center', padding: 20 },
  cardContainer: { borderRadius: 20, padding: 24, borderWidth: 1, alignItems: 'center' },
  landingBanner: { width: '100%', height: 160, borderRadius: 12, marginBottom: 16 },
  quizTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  startButton: { width: '100%', paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  startButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginTop: 16 },
  pillBadgeText: { fontSize: 12, fontWeight: 'bold' },
});
