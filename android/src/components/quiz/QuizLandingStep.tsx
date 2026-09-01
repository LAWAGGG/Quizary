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
    <QuizBackground themeColor={themeColor} isQuizDesign={isQuizDesign}>
      <SafeAreaView style={styles.landingContainer}>
        <StatusBar style={isQuizDesign ? 'light' : (isDark ? 'light' : 'dark')} />

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

          {isQuizDesign ? (
            <View style={styles.brandTitleRowCentered}>
              <Image source={require('../../../assets/images/Quizary_Logo_White.png')} style={styles.brandLogo} resizeMode="contain" />
              <Text style={styles.brandTitleText}>Quizary</Text>
            </View>
          ) : null}

          {/* Dummy view for symmetry in Header */}
          {isQuizDesign ? <View style={{ width: 40 }} /> : null}
        </View>

        {isQuizDesign ? (
          /* DESIGN QUIZ: Fullscreen Hero matching Web Screenshot 1 */
          <View style={styles.quizHeroWrapper}>
            <ScrollView contentContainerStyle={styles.quizHeroScrollContent} showsVerticalScrollIndicator={false}>
              {/* Banner Image with subtle border */}
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.heroBannerQuizStyle} resizeMode="cover" />
              ) : null}

              {/* Form Title */}
              <Text style={[styles.quizTitleQuizStyle, { fontSize: 32 * fontSizeScale }]}>
                {stripHtmlTags(publicForm?.title) || (language === 'ID' ? 'Kuis' : 'Quiz')}
              </Text>

              {/* Form Description */}
              {publicForm?.description ? (
                <View style={{ marginBottom: 16, width: '100%', alignItems: 'center' }}>
                  <RichTextRenderer
                    html={publicForm.description}
                    style={{
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontSize: 15 * fontSizeScale,
                      lineHeight: 22,
                      textAlign: 'center',
                    }}
                  />
                </View>
              ) : null}

              {/* Metadata Pill Badges (Dark translucent pills matching Web) */}
              <View style={styles.metaPillsRowQuizStyle}>
                <View style={styles.pillBadgeQuizStyle}>
                  <Ionicons name="help-circle-outline" size={16 * fontSizeScale} color="#FFF" />
                  <Text style={[styles.pillBadgeTextQuizStyle, { fontSize: 13 * fontSizeScale }]}>
                    {language === 'ID' ? `${qCount} questions` : `${qCount} questions`}
                  </Text>
                </View>

                <View style={styles.pillBadgeQuizStyle}>
                  <Ionicons name="time-outline" size={16 * fontSizeScale} color="#FFF" />
                  <Text style={[styles.pillBadgeTextQuizStyle, { fontSize: 13 * fontSizeScale }]}>
                    {timeLimit
                      ? (language === 'ID' ? `${timeLimit} min` : `${timeLimit} min`)
                      : (language === 'ID' ? 'No time limit' : 'No time limit')}
                  </Text>
                </View>
              </View>

              {/* Start Button (Centered White Rounded Pill matching Web) */}
              <TouchableOpacity
                style={styles.startButtonQuizStyle}
                onPress={onStart}
                disabled={starting}
                activeOpacity={0.85}
              >
                {starting ? (
                  <ActivityIndicator color={themeColor} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.startButtonTextQuizStyle, { color: themeColor, fontSize: 16 * fontSizeScale }]}>
                      {language === 'ID' ? 'Start' : 'Start'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={themeColor} />
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* Bottom Row of 12 Circular Bubbles (Matching Web Screenshot) */}
            <View style={styles.bubblesRow}>
              {Array.from({ length: 12 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubbleDot,
                    (i === 2 || i === 5 || i === 8)
                      ? { backgroundColor: '#FFF', borderColor: '#FFF' }
                      : { borderColor: 'rgba(255, 255, 255, 0.25)' },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          /* DESIGN FORM: Card Layout */
          <ScrollView contentContainerStyle={styles.scrollContentForm} showsVerticalScrollIndicator={false}>
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={styles.heroBannerForm} resizeMode="cover" />
            ) : null}

            <View style={[styles.titleCardForm, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.quizTitleForm, { color: colors.text, fontSize: 24 * fontSizeScale }]}>
                {stripHtmlTags(publicForm?.title) || (language === 'ID' ? 'Kuis' : 'Quiz')}
              </Text>

              {publicForm?.description ? (
                <View style={{ marginBottom: 20 }}>
                  <RichTextRenderer
                    html={publicForm.description}
                    style={{ color: colors.textSub, fontSize: 14 * fontSizeScale, lineHeight: 20 }}
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.startButtonForm, { backgroundColor: themeColor }]}
                onPress={onStart}
                disabled={starting}
                activeOpacity={0.85}
              >
                {starting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.startButtonTextForm, { fontSize: 16 * fontSizeScale }]}>
                    {language === 'ID' ? '→ Mulai' : '→ Start'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.metaPillsRowForm}>
              <View style={[styles.pillBadgeForm, { borderColor: colors.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Ionicons name="help-circle-outline" size={16 * fontSizeScale} color={colors.textMuted} />
                <Text style={[styles.pillBadgeTextForm, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  {language === 'ID' ? `${qCount} Soal` : `${qCount} questions`}
                </Text>
              </View>

              <View style={[styles.pillBadgeForm, { borderColor: colors.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Ionicons name="time-outline" size={16 * fontSizeScale} color={colors.textMuted} />
                <Text style={[styles.pillBadgeTextForm, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  {timeLimit
                    ? (language === 'ID' ? `${timeLimit} menit` : `${timeLimit} min`)
                    : (language === 'ID' ? 'Tanpa batas waktu' : 'No time limit')}
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </QuizBackground>
  );
}

const styles = StyleSheet.create({
  landingContainer: { flex: 1 },
  landingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  iconCircleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  brandTitleRowCentered: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { width: 28, height: 28 },
  brandTitleText: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },

  /* QUIZ STYLE (Full Match with Web Screenshot 1) */
  quizHeroWrapper: { flex: 1, justifyContent: 'space-between' },
  quizHeroScrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20, alignItems: 'center', justifyContent: 'center' },
  heroBannerQuizStyle: { width: '100%', height: 180, borderRadius: 20, marginBottom: 20, borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.25)' },
  quizTitleQuizStyle: { color: '#FFF', fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  
  metaPillsRowQuizStyle: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 12 },
  pillBadgeQuizStyle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: 'rgba(15, 23, 42, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  pillBadgeTextQuizStyle: { color: '#FFF', fontWeight: '700' },

  startButtonQuizStyle: { backgroundColor: '#FFFFFF', paddingHorizontal: 44, paddingVertical: 14, borderRadius: 30, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  startButtonTextQuizStyle: { fontWeight: '800' },

  bubblesRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 24 },
  bubbleDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },

  /* FORM STYLE */
  scrollContentForm: { padding: 20, paddingBottom: 40, justifyContent: 'center' },
  heroBannerForm: { width: '100%', height: 180, borderRadius: 20, marginBottom: 16 },
  titleCardForm: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1, marginBottom: 16 },
  quizTitleForm: { fontWeight: '800', marginBottom: 10 },
  startButtonForm: { width: '100%', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startButtonTextForm: { color: '#FFF', fontWeight: 'bold' },
  metaPillsRowForm: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  pillBadgeForm: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  pillBadgeTextForm: { fontWeight: '600' },
});
