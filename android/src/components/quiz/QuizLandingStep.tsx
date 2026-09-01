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

  const displayStyle = publicForm?.display_style || 'card';
  const qCount = publicForm?.question_count || (publicForm?.questions ? publicForm.questions.length : 0);
  const timeLimit = publicForm?.timer_seconds
    ? Math.ceil(publicForm.timer_seconds / 60)
    : (publicForm?.time_limit || publicForm?.duration || publicForm?.settings?.time_limit);

  const bannerUri = publicForm?.banner_path || publicForm?.banner_url || publicForm?.banner;

  const isQuizDesign = displayStyle === 'quiz';

  return (
    <QuizBackground themeColor={themeColor}>
      <SafeAreaView style={styles.landingContainer}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Top Header Navigation */}
        <View style={styles.landingHeader}>
          <TouchableOpacity
            style={[
              styles.iconCircleBtn,
              {
                backgroundColor: isQuizDesign ? 'rgba(255, 255, 255, 0.15)' : colors.cardBg,
                borderColor: isQuizDesign ? 'rgba(255, 255, 255, 0.25)' : colors.inputBorder,
              },
            ]}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="arrow-back" size={20} color={isQuizDesign ? '#FFF' : colors.text} />
          </TouchableOpacity>

          {isQuizDesign && (
            <View style={styles.brandTitleRow}>
              <Image source={require('../../../assets/images/Quizary_Logo_White.png')} style={styles.brandLogo} resizeMode="contain" />
              <Text style={styles.brandTitleText}>Quizary</Text>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner Hero Image (if present) */}
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.heroBanner} resizeMode="cover" />
          ) : null}

          {/* Title & Description Main Card / Hero Container */}
          <View
            style={[
              isQuizDesign ? styles.heroTitleContainer : styles.titleCard,
              !isQuizDesign && { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            ]}
          >
            <Text
              style={[
                styles.quizTitle,
                isQuizDesign ? styles.heroQuizTitle : { color: colors.text, fontSize: 24 * fontSizeScale },
              ]}
            >
              {stripHtmlTags(publicForm?.title) || (language === 'ID' ? 'Kuis' : 'Quiz')}
            </Text>

            {publicForm?.description ? (
              <View style={{ marginBottom: 20, width: '100%' }}>
                <RichTextRenderer
                  html={publicForm.description}
                  style={{
                    color: isQuizDesign ? 'rgba(255, 255, 255, 0.9)' : colors.textSub,
                    fontSize: 14 * fontSizeScale,
                    lineHeight: 22,
                    textAlign: isQuizDesign ? 'center' : 'left',
                  }}
                />
              </View>
            ) : null}

            {/* Quiz Info Badges (Shown inside Hero in Quiz Design) */}
            {isQuizDesign && (
              <View style={styles.metaPillsRowHero}>
                <View style={styles.pillBadgeHero}>
                  <Ionicons name="help-circle-outline" size={14 * fontSizeScale} color="#FFF" />
                  <Text style={styles.pillBadgeTextHero}>
                    {language === 'ID' ? `${qCount} Soal` : `${qCount} questions`}
                  </Text>
                </View>

                <View style={styles.pillBadgeHero}>
                  <Ionicons name="time-outline" size={14 * fontSizeScale} color="#FFF" />
                  <Text style={styles.pillBadgeTextHero}>
                    {timeLimit
                      ? (language === 'ID' ? `${timeLimit} menit` : `${timeLimit} min`)
                      : (language === 'ID' ? 'Tanpa batas waktu' : 'No time limit')}
                  </Text>
                </View>
              </View>
            )}

            {/* Start Action Button */}
            <TouchableOpacity
              style={[
                styles.startButton,
                isQuizDesign
                  ? styles.heroStartButton
                  : { backgroundColor: themeColor },
              ]}
              onPress={onStart}
              disabled={starting}
              activeOpacity={0.85}
            >
              {starting ? (
                <ActivityIndicator color={isQuizDesign ? themeColor : '#FFF'} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.startButtonText,
                      isQuizDesign ? { color: themeColor, fontSize: 17 * fontSizeScale } : { color: '#FFF', fontSize: 16 * fontSizeScale },
                    ]}
                  >
                    {language === 'ID' ? 'Mulai' : 'Start'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={isQuizDesign ? themeColor : '#FFF'} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Metadata Pill Badges Row (Shown below card in Form Design) */}
          {!isQuizDesign && (
            <View style={styles.metaPillsRow}>
              <View style={[styles.pillBadge, { borderColor: colors.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Ionicons name="help-circle-outline" size={16 * fontSizeScale} color={colors.textMuted} />
                <Text style={[styles.pillBadgeText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  {language === 'ID' ? `${qCount} Soal` : `${qCount} questions`}
                </Text>
              </View>

              <View style={[styles.pillBadge, { borderColor: colors.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Ionicons name="time-outline" size={16 * fontSizeScale} color={colors.textMuted} />
                <Text style={[styles.pillBadgeText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  {timeLimit
                    ? (language === 'ID' ? `${timeLimit} menit` : `${timeLimit} min`)
                    : (language === 'ID' ? 'Tanpa batas waktu' : 'No time limit')}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </QuizBackground>
  );
}

const styles = StyleSheet.create({
  landingContainer: { flex: 1 },
  landingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  iconCircleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { width: 28, height: 28 },
  brandTitleText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  scrollContent: { padding: 20, paddingBottom: 40, justifyContent: 'center', alignItems: 'center' },
  
  heroBanner: { width: '100%', height: 180, borderRadius: 20, marginBottom: 20 },

  titleCard: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1, marginBottom: 16 },
  heroTitleContainer: { width: '100%', alignItems: 'center', marginVertical: 12, paddingHorizontal: 10 },
  
  quizTitle: { fontWeight: '800', marginBottom: 10 },
  heroQuizTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 12, lineHeight: 36 },
  
  startButton: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroStartButton: { backgroundColor: '#FFFFFF', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5, marginTop: 16 },
  startButtonText: { fontWeight: 'bold' },

  metaPillsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  metaPillsRowHero: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  pillBadgeHero: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
  pillBadgeText: { fontWeight: '600' },
  pillBadgeTextHero: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
