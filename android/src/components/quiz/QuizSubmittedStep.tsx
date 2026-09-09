import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { stripHtmlTags } from '../RichTextRenderer';
import { getSubmissionDetail, getLeaderboard } from '../../services/api_service';

interface QuizSubmittedStepProps {
  resultData: any;
  submissionId?: string | number;
  publicForm?: any;
  onFillAgain?: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface AnimatedScoreCircleProps {
  score: number;
  maxScore: number;
  ringColor: string;
  isDark: boolean;
  textColor: string;
  textSubColor: string;
  ready?: boolean;
}

function AnimatedScoreCircle({
  score,
  maxScore,
  ringColor,
  isDark,
  textColor,
  textSubColor,
  ready = true,
}: AnimatedScoreCircleProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  const targetScore = Math.round(score);
  const percentage = maxScore > 0 ? Math.min(100, Math.max(0, Math.round((targetScore / maxScore) * 100))) : 0;

  useEffect(() => {
    if (!ready) return;

    animatedValue.setValue(0);
    scaleAnim.setValue(0.6);
    opacityAnim.setValue(0);
    setDisplayScore(0);

    const listenerId = animatedValue.addListener(({ value }) => {
      const currentPct = Math.min(100, Math.max(0, value));
      const currentVal = percentage > 0
        ? Math.round((currentPct / percentage) * targetScore)
        : 0;
      setDisplayScore(currentVal);
    });

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: percentage,
        duration: 1200,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [percentage, targetScore, maxScore, ready]);

  const firstHalfRotate = animatedValue.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ['-180deg', '0deg', '0deg'],
    extrapolate: 'clamp',
  });

  const secondHalfRotate = animatedValue.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ['-180deg', '-180deg', '0deg'],
    extrapolate: 'clamp',
  });

  const tipRotate = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'clamp',
  });

  const trackColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0';

  return (
    <Animated.View
      style={[
        circleStyles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Outer Ring Container starting from 12 o'clock */}
      <View style={circleStyles.ringWrapper}>
        {/* Background Track Circle */}
        <View style={[circleStyles.trackCircle, { borderColor: trackColor }]} />

        {/* Right Half Mask (12 o'clock -> 6 o'clock) */}
        <View style={circleStyles.rightMask}>
          <Animated.View
            style={[
              circleStyles.halfCircleRight,
              {
                borderColor: ringColor,
                transform: [{ rotate: firstHalfRotate }],
              },
            ]}
          />
        </View>

        {/* Left Half Mask (6 o'clock -> 12 o'clock) */}
        <View style={circleStyles.leftMask}>
          <Animated.View
            style={[
              circleStyles.halfCircleLeft,
              {
                borderColor: ringColor,
                transform: [{ rotate: secondHalfRotate }],
              },
            ]}
          />
        </View>
      </View>

      {/* Inner Content Display (Score / MaxScore) */}
      <View style={[circleStyles.innerContent, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
        <Text style={[circleStyles.scoreText, { color: textColor }]}>{displayScore}</Text>
        {maxScore > 0 && (
          <Text style={[circleStyles.maxScoreText, { color: textSubColor }]}>/{Math.round(maxScore)}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const circleStyles = StyleSheet.create({
  container: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  ringWrapper: {
    width: 140,
    height: 140,
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  trackCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    position: 'absolute',
  },
  rightMask: {
    width: 70,
    height: 140,
    position: 'absolute',
    left: 70,
    top: 0,
    overflow: 'hidden',
  },
  leftMask: {
    width: 70,
    height: 140,
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  halfCircleRight: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    position: 'absolute',
    left: -70,
    top: 0,
  },
  halfCircleLeft: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  startCapDot: {
    position: 'absolute',
    top: 0,
    left: 65,
  },
  tipRotator: {
    width: 140,
    height: 140,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  capDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
  },
  innerContent: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scoreText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  maxScoreText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: -2,
  },
});

function formatSubmitted(str?: string) {
  if (!str) return '—';
  const parts = str.split(/[\s:-]+/);
  if (parts.length >= 3) {
    const d = Number(parts[0]);
    const m = Number(parts[1]);
    const y = Number(parts[2]);
    if (d && m && y) {
      return `${d} ${MONTHS[m - 1] || m} ${y}`;
    }
  }
  return str;
}

export function QuizSubmittedStep({ resultData, submissionId, publicForm, onFillAgain }: QuizSubmittedStepProps) {
  const { colors, isDark, language } = useAppTheme();

  const sid = submissionId || resultData?.submission_id;
  const [subDetail, setSubDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(!!sid);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [showReview, setShowReview] = useState<boolean>(false);

  const formCode = publicForm?.short_code;
  const formType = publicForm?.type || resultData?.type || subDetail?.type || 'quiz';
  const isQuiz = formType === 'quiz';
  const canRefill = publicForm?.submission_limit === 'unlimited';

  useEffect(() => {
    let isMounted = true;
    if (sid) {
      getSubmissionDetail(sid)
        .then((detail) => {
          if (isMounted && detail) {
            setSubDetail(detail);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingDetail(false);
        });
    } else {
      setLoadingDetail(false);
    }

    if (isQuiz && formCode && publicForm?.show_leaderboard) {
      getLeaderboard(formCode, sid)
        .then((lb) => {
          if (isMounted && lb) setLeaderboard(lb);
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [sid, formCode, isQuiz, publicForm?.show_leaderboard]);

  const rawScore = subDetail?.score ?? resultData?.score;
  const maxScore = subDetail?.max_score ?? resultData?.max_score ?? 100;
  const finalScore = rawScore != null ? Math.round(Number(rawScore)) : null;

  const answersList = subDetail?.answers || [];
  const correctCount = answersList.filter((a: any) => a.is_correct === true).length;
  const wrongCount = answersList.filter((a: any) => a.is_correct === false).length;
  const unansweredCount = answersList.filter((a: any) => a.is_correct === null).length;

  const percentage = maxScore > 0 && finalScore != null ? Math.round((finalScore / maxScore) * 100) : 0;
  const ringColor = percentage >= 70 ? '#10B981' : percentage >= 40 ? '#F59E0B' : '#EF4444';

  const formTitle = publicForm?.title || resultData?.form_title || '';
  const cleanTitle = stripHtmlTags(formTitle);
  const isCheating = subDetail?.status === 'cheating' || resultData?.status === 'cheating';
  const submittedAt = subDetail?.submitted_at || resultData?.submitted_at;
  const totalQuestions = answersList.length || publicForm?.questions?.length || resultData?.questions?.length || 0;

  const themeColor =
    publicForm?.theme_color ||
    publicForm?.color ||
    publicForm?.themeColor ||
    publicForm?.settings?.theme_color ||
    resultData?.theme_color ||
    colors.primary;

  const ringOuterBg = themeColor.startsWith('#')
    ? `${themeColor}22`
    : (isDark ? 'rgba(236, 72, 153, 0.15)' : '#FCE7F3');

  const isOfflinePending = resultData?.is_offline_pending || subDetail?.is_offline_pending;

  // ==========================================
  // FORM MODE DESIGN (Non-Quiz / Survey / Form)
  // Matches Web Screenshot 2
  // ==========================================
  if (!isQuiz) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.scrollContentCenter} showsVerticalScrollIndicator={false}>
          
          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            {/* Checkmark Icon Circle */}
            <View style={[styles.checkOuterRing, { backgroundColor: ringOuterBg }]}>
              <View style={[styles.checkCircleBg, { backgroundColor: themeColor, shadowColor: themeColor }]}>
                <Ionicons name="checkmark" size={32} color="#FFF" />
              </View>
            </View>

            {/* Eyebrow Label */}
            <Text style={[styles.formEyebrow, { color: themeColor }]}>
              {language === 'ID' ? 'SUBMITTED' : 'SUBMITTED'}
            </Text>

            {/* Title */}
            <Text style={[styles.formMainTitle, { color: colors.text }]}>
              {language === 'ID'
                ? `Form ${cleanTitle || 'soal'} submitted successfully!`
                : `Form ${cleanTitle || 'form'} submitted successfully!`}
            </Text>

            {/* Offline Pending Sync Badge */}
            {isOfflinePending && (
              <View style={styles.offlinePendingBadge}>
                <Ionicons name="cloud-offline-outline" size={16} color="#F59E0B" />
                <Text style={styles.offlinePendingText}>
                  {language === 'ID'
                    ? 'Tersimpan di Lokal (Otomatis Kirim Saat Online)'
                    : 'Saved Locally (Auto-Syncing When Online)'}
                </Text>
              </View>
            )}

            {/* Description Subtext */}
            <Text style={[styles.formDescText, { color: colors.textSub }]}>
              {language === 'ID'
                ? `Jawaban Anda untuk "${cleanTitle}" telah berhasil disimpan.`
                : `Your response to "${cleanTitle}" has been recorded.`}
            </Text>

            {/* MetaChips Row (QUESTIONS | SUBMITTED) */}
            <View style={styles.formMetaRow}>
              <View style={[styles.formMetaChip, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.cardBorder }]}>
                <Text style={styles.formMetaLabel}>
                  {language === 'ID' ? 'QUESTIONS' : 'QUESTIONS'}
                </Text>
                <Text style={[styles.formMetaValue, { color: colors.text }]}>
                  {totalQuestions}
                </Text>
              </View>

              <View style={[styles.formMetaChip, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.cardBorder }]}>
                <Text style={styles.formMetaLabel}>
                  {language === 'ID' ? 'SUBMITTED' : 'SUBMITTED'}
                </Text>
                <Text style={[styles.formMetaValue, { color: colors.text }]} numberOfLines={1}>
                  {formatSubmitted(submittedAt)}
                </Text>
              </View>
            </View>

            {/* Fill Again Button if allowed */}
            {canRefill && (
              <TouchableOpacity
                style={[styles.fillAgainBtn, { backgroundColor: themeColor }]}
                onPress={() => {
                  if (onFillAgain) {
                    onFillAgain();
                  } else if (formCode) {
                    router.replace(`/quiz?code=${formCode}` as any);
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
                <Text style={styles.fillAgainBtnText}>
                  {language === 'ID' ? 'Isi Lagi' : 'Fill Again'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Back to Dashboard Button */}
            <TouchableOpacity
              style={[styles.backHomeBtn, { backgroundColor: canRefill ? (isDark ? '#1E293B' : '#F1F5F9') : themeColor, marginTop: 12 }]}
              onPress={() => router.replace('/(tabs)/home')}
              activeOpacity={0.85}
            >
              <Ionicons name="home-outline" size={18} color={canRefill ? colors.text : '#FFF'} />
              <Text style={[styles.backHomeBtnText, { color: canRefill ? colors.text : '#FFF' }]}>
                {language === 'ID' ? 'Kembali ke Dashboard' : 'Back to Dashboard'}
              </Text>
            </TouchableOpacity>

            {!canRefill && (
              <Text style={[styles.closePageSubtext, { color: colors.textMuted }]}>
                {language === 'ID' ? 'You can close this page.' : 'You can close this page.'}
              </Text>
            )}

          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // QUIZ MODE DESIGN (Quiz / Exam with score)
  // Matches Web Screenshot 1
  // ==========================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Eyebrow Form Title */}
        {cleanTitle ? (
          <Text style={[styles.eyebrow, { color: themeColor }]}>
            {cleanTitle.toUpperCase()}
          </Text>
        ) : null}

        {/* Main Success Title */}
        <Text style={[styles.mainTitle, { color: colors.text }]}>
          {language === 'ID'
            ? `Form ${cleanTitle || 'soal'} submitted successfully!`
            : `Form ${cleanTitle || 'quiz'} submitted successfully!`}
        </Text>

        {/* Cheating Warning Badge if applicable */}
        {isCheating && (
          <View style={styles.cheatingBadge}>
            <Ionicons name="warning-outline" size={16} color="#EF4444" />
            <Text style={styles.cheatingText}>⚠️ Status: Cheating</Text>
          </View>
        )}

        {/* Score Ring Gauge */}
        {finalScore != null && (
          <View style={styles.scoreGaugeContainer}>
            <AnimatedScoreCircle
              score={finalScore}
              maxScore={maxScore}
              ringColor={ringColor}
              isDark={isDark}
              textColor={colors.text}
              textSubColor={colors.textSub}
              ready={!loadingDetail}
            />

            <Text style={[styles.encouragementText, { color: colors.textSub }]}>
              {percentage >= 70
                ? (language === 'ID' ? 'Kerja bagus! Hasil yang luar biasa.' : 'Great job — outstanding result!')
                : percentage >= 40
                ? (language === 'ID' ? 'Good effort — keep practicing.' : 'Good effort — keep practicing.')
                : (language === 'ID' ? 'Terus berlatih untuk hasil yang lebih baik.' : 'Keep practicing to improve.')}
            </Text>

            {/* Stats Chips (CORRECT | WRONG | SKIPPED) */}
            {answersList.length > 0 && (
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <Text style={styles.statLabel}>CORRECT</Text>
                  <Text style={[styles.statValue, { color: '#10B981' }]}>{correctCount}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <Text style={styles.statLabel}>WRONG</Text>
                  <Text style={[styles.statValue, { color: '#EF4444' }]}>{wrongCount}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <Text style={styles.statLabel}>SKIPPED</Text>
                  <Text style={[styles.statValue, { color: colors.textSub }]}>{unansweredCount}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* View Answer Review Button */}
        {answersList.length > 0 && (
          <TouchableOpacity
            style={[styles.reviewBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: colors.cardBorder }]}
            onPress={() => setShowReview(!showReview)}
            activeOpacity={0.8}
          >
            <Ionicons name={showReview ? "eye-off-outline" : "eye-outline"} size={18} color={colors.text} />
            <Text style={[styles.reviewBtnText, { color: colors.text }]}>
              {showReview
                ? (language === 'ID' ? 'Sembunyikan Review' : 'Hide Answer Review')
                : (language === 'ID' ? 'View Answer Review' : 'View Answer Review')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Answer Review Accordion Section */}
        {showReview && (
          <View style={styles.reviewList}>
            {answersList.map((a: any, i: number) => {
              const isCorrect = a.is_correct;
              const cleanQText = stripHtmlTags(a.question_text || '');
              return (
                <View
                  key={a.question_id || i}
                  style={[styles.answerCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                >
                  <View style={styles.answerCardHeader}>
                    {isCorrect === true ? (
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    ) : isCorrect === false ? (
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    ) : (
                      <Ionicons name="remove-circle" size={24} color={colors.textSub} />
                    )}
                    <View style={styles.answerCardContent}>
                      <Text style={[styles.qIndexText, { color: colors.textSub }]}>
                        {language === 'ID' ? `Soal #${i + 1}` : `Question #${i + 1}`}
                      </Text>
                      <Text style={[styles.qText, { color: colors.text }]}>{cleanQText}</Text>
                      
                      {a.question_image && (
                        <Image source={{ uri: a.question_image }} style={styles.qImg} resizeMode="contain" />
                      )}

                      <Text style={[styles.yourAnsLabel, { color: colors.textSub }]}>
                        {language === 'ID' ? 'Jawaban Anda:' : 'Your Answer:'}
                      </Text>
                      <Text style={[styles.yourAnsText, { color: colors.text }]}>
                        {a.selected_options && a.selected_options.length > 0
                          ? a.selected_options.map((opt: string) => stripHtmlTags(opt)).join(', ')
                          : a.answer_text
                          ? stripHtmlTags(a.answer_text)
                          : a.answer_file
                          ? 'File uploaded'
                          : (language === 'ID' ? '(Tidak dijawab)' : '(Not answered)')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Leaderboard Card Section */}
        {leaderboard && leaderboard.data && leaderboard.data.length > 0 && (
          <View style={[styles.leaderboardCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.lbHeader}>
              <View style={styles.trophyCircle}>
                <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
              </View>
              <View>
                <Text style={[styles.lbTitle, { color: colors.text }]}>
                  {language === 'ID' ? 'Leaderboard' : 'Leaderboard'}
                </Text>
                <Text style={[styles.lbSub, { color: colors.textSub }]}>
                  {language === 'ID' ? `${leaderboard.total || leaderboard.data.length} peserta` : `${leaderboard.total || leaderboard.data.length} participants`}
                </Text>
              </View>
            </View>

            <View style={styles.lbList}>
              {leaderboard.data.map((row: any) => {
                const isMe = leaderboard.own && row.rank === leaderboard.own.rank;
                return (
                  <View
                    key={row.rank}
                    style={[
                      styles.lbRow,
                      { backgroundColor: isMe ? (isDark ? '#1E3A8A' : '#EFF6FF') : (isDark ? '#0F172A' : '#F8FAFC') },
                      isMe && { borderColor: '#3B82F6', borderWidth: 1 }
                    ]}
                  >
                    <View
                      style={[
                        styles.rankBadge,
                        {
                          backgroundColor:
                            row.rank === 1
                              ? '#F59E0B'
                              : row.rank === 2
                              ? '#94A3B8'
                              : row.rank === 3
                              ? '#EA580C'
                              : isDark
                              ? '#334155'
                              : '#E2E8F0',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rankBadgeText,
                          { color: [1, 2, 3].includes(row.rank) ? '#FFF' : colors.text },
                        ]}
                      >
                        {row.rank}
                      </Text>
                    </View>

                    <Text style={[styles.lbName, { color: colors.text }]} numberOfLines={1}>
                      {row.respondent_name}
                      {isMe && (
                        <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                          {language === 'ID' ? ' (Anda)' : ' (You)'}
                        </Text>
                      )}
                    </Text>

                    <Text style={[styles.lbScore, { color: colors.text }]}>{row.score}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Footer Hint */}
        <View style={styles.footerHintRow}>
          <Ionicons name="clipboard-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.footerHintText, { color: colors.textMuted }]}>
            {language === 'ID' ? 'You can close this page.' : 'You can close this page.'}
          </Text>
        </View>

        {/* Fill Again Button if allowed */}
        {canRefill && (
          <TouchableOpacity
            style={[styles.fillAgainBtn, { backgroundColor: themeColor, marginBottom: 12 }]}
            onPress={() => {
              if (onFillAgain) {
                onFillAgain();
              } else if (formCode) {
                router.replace(`/quiz?code=${formCode}` as any);
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
            <Text style={styles.fillAgainBtnText}>
              {language === 'ID' ? 'Isi Lagi' : 'Fill Again'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Back to Home Button */}
        <TouchableOpacity
          style={[styles.backHomeBtn, { backgroundColor: canRefill ? (isDark ? '#1E293B' : '#F1F5F9') : themeColor }]}
          onPress={() => router.replace('/(tabs)/home')}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={18} color={canRefill ? colors.text : '#FFF'} />
          <Text style={[styles.backHomeBtnText, { color: canRefill ? colors.text : '#FFF' }]}>
            {language === 'ID' ? 'Kembali ke Dashboard' : 'Back to Dashboard'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  scrollContentCenter: { padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: '100%' },
  
  // Form Mode Styles (Web Screenshot 2)
  formCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  offlinePendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 10,
  },
  offlinePendingText: {
    color: '#F59E0B',
    fontWeight: 'bold',
    fontSize: 12,
  },
  checkOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkCircleBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  formEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  formMainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 26,
  },
  formDescText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  formMetaRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  formMetaChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  formMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#94A3B8',
    marginBottom: 4,
  },
  formMetaValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  fillAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  fillAgainBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  closePageSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },

  // Quiz Mode Styles
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, textAlign: 'center' },
  mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, lineHeight: 28 },
  cheatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  cheatingText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  scoreGaugeContainer: { alignItems: 'center', marginVertical: 12, width: '100%' },
  outerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  innerRingBg: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: { fontSize: 34, fontWeight: 'bold' },
  maxScoreVal: { fontSize: 13, marginTop: -2 },
  encouragementText: { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'center', marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: '#94A3B8' },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    marginBottom: 16,
  },
  reviewBtnText: { fontWeight: '600', fontSize: 14 },
  reviewList: { width: '100%', gap: 10, marginBottom: 16 },
  answerCard: { borderRadius: 12, padding: 14, borderWidth: 1 },
  answerCardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  answerCardContent: { flex: 1 },
  qIndexText: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  qText: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  qImg: { width: '100%', height: 140, borderRadius: 8, marginBottom: 8 },
  yourAnsLabel: { fontSize: 12, fontWeight: '500' },
  yourAnsText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  leaderboardCard: { borderRadius: 16, padding: 16, borderWidth: 1, width: '100%', marginBottom: 20 },
  lbHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  trophyCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lbTitle: { fontSize: 16, fontWeight: 'bold' },
  lbSub: { fontSize: 12 },
  lbList: { gap: 8 },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
  },
  rankBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  rankBadgeText: { fontSize: 12, fontWeight: 'bold' },
  lbName: { flex: 1, fontSize: 13, fontWeight: '600' },
  lbScore: { fontSize: 14, fontWeight: 'bold' },
  footerHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  footerHintText: { fontSize: 12 },
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  backHomeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
