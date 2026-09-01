import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { RichTextRenderer, stripHtmlTags } from '../RichTextRenderer';
import { QuizBackground } from './QuizBackground';

interface QuizLandingStepProps {
  publicForm: any;
  starting: boolean;
  onStart: () => void;
}

export function QuizLandingStep({ publicForm, starting, onStart }: QuizLandingStepProps) {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();

  // Custom Theme Color set per Form (e.g. theme_color or color property)
  const themeColor =
    publicForm?.theme_color ||
    publicForm?.color ||
    publicForm?.themeColor ||
    publicForm?.settings?.theme_color ||
    colors.primary;

  const qCount = publicForm?.question_count || (publicForm?.questions ? publicForm.questions.length : 0);
  const timeLimit = publicForm?.time_limit || publicForm?.duration || publicForm?.settings?.time_limit;

  const bannerUri = publicForm?.banner_path || publicForm?.banner_url || publicForm?.banner;

  return (
    <QuizBackground themeColor={themeColor}>
      <SafeAreaView style={styles.landingContainer}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Top Header */}
        <View style={styles.landingHeader}>
          <TouchableOpacity
            style={[styles.iconCircleBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner Hero Image (Top Standalone Element) */}
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.heroBanner} resizeMode="cover" />
          ) : (
            <View style={[styles.defaultHeroBanner, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#E2E8F0' }]}>
              <Ionicons name="image-outline" size={48} color={colors.textMuted} />
            </View>
          )}

          {/* Title & Description Main Card */}
          <View style={[styles.titleCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={{ marginBottom: 12 }}>
              <RichTextRenderer
                html={publicForm?.title || (language === 'ID' ? 'Kuis' : 'Quiz')}
                style={[styles.quizTitle, { color: colors.text, fontSize: 24 * fontSizeScale }]}
              />
            </View>

            {publicForm?.description ? (
              <View style={{ marginBottom: 20 }}>
                <RichTextRenderer
                  html={publicForm.description}
                  style={{ color: colors.textSub, fontSize: 14 * fontSizeScale, lineHeight: 20 }}
                />
              </View>
            ) : null}

            {/* Start Action Button using Form's Custom Theme Color */}
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
                  <Text style={[styles.startButtonText, { fontSize: 16 * fontSizeScale }]}>
                    {language === 'ID' ? '→ Mulai' : '→ Start'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Metadata Pill Badges Row (Below Title Card) */}
          <View style={styles.metaPillsRow}>
            {/* Question Count Pill */}
            <View style={[styles.pillBadge, { borderColor: colors.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
              <Ionicons name="help-circle-outline" size={16 * fontSizeScale} color={colors.textMuted} />
              <Text style={[styles.pillBadgeText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                {language === 'ID' ? `${qCount} Soal` : `${qCount} questions`}
              </Text>
            </View>

            {/* Time Limit Pill */}
            <View style={[styles.pillBadge, { borderColor: colors.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
              <Ionicons name="time-outline" size={16 * fontSizeScale} color={colors.textMuted} />
              <Text style={[styles.pillBadgeText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                {timeLimit
                  ? (language === 'ID' ? `${timeLimit} menit` : `${timeLimit} min`)
                  : (language === 'ID' ? 'Tanpa batas waktu' : 'No time limit')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </QuizBackground>
  );
}

const styles = StyleSheet.create({
  landingContainer: { flex: 1 },
  landingHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  iconCircleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40, justifyContent: 'center' },
  
  heroBanner: { width: '100%', height: 180, borderRadius: 20, marginBottom: 16 },
  defaultHeroBanner: { width: '100%', height: 160, borderRadius: 20, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },

  titleCard: { borderRadius: 20, padding: 24, borderWidth: 1, marginBottom: 16 },
  quizTitle: { fontWeight: '800', marginBottom: 10 },
  
  startButton: { width: '100%', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startButtonText: { color: '#FFF', fontWeight: 'bold' },

  metaPillsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  pillBadgeText: { fontWeight: '600' },
});
