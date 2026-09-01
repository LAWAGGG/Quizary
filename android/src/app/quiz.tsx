import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, AppState, Image, Animated, Platform, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  getPublicForm,
  createSubmission,
  autosaveAnswer,
  finalizeSubmission,
  getSubmissionDetail,
  uploadAnswerFile,
  lockSubmission,
} from '../services/api_service';
import { useAppTheme } from '../context/ThemeContext';
import { useAppAlert } from '../context/AlertContext';
import { stripHtmlTags } from '../components/RichTextRenderer';
import { QuizLandingStep } from '../components/quiz/QuizLandingStep';
import { QuizQuestionCard } from '../components/quiz/QuizQuestionCard';
import { QuizSubmittedStep } from '../components/quiz/QuizSubmittedStep';
import { QuizStyleAnsweringStep } from '../components/quiz/QuizStyleAnsweringStep';
import { QuestionZoomModal } from '../components/quiz/QuestionZoomModal';
import LockOverlay from '../components/quiz/LockOverlay';
import { QuizBackground } from '../components/quiz/QuizBackground';

export default function StandaloneQuizScreen() {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const { showAlert } = useAppAlert();
  const { shortCode, formId } = useLocalSearchParams<{ shortCode?: string; formId?: string }>();

  // Zoom & Modal states
  const [zoomQuestionTarget, setZoomQuestionTarget] = useState<any>(null);

  // Data states
  const [publicForm, setPublicForm] = useState<any>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const submissionIdRef = useRef<number | string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [fileUploading, setFileUploading] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Flow states
  const [step, setStep] = useState<'loading' | 'landing' | 'answering' | 'submitted' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // Smooth Section Transition Animation & Scroll Ref (Matching Web Framer Motion)
  const [direction, setDirection] = useState<number>(1);
  const [visibleLimit, setVisibleLimit] = useState<number>(6);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Anti-cheat & Lock states
  const [isLocked, setIsLocked] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(false);
  const appState = useRef(AppState.currentState);

  // Synchronize ref whenever submissionId updates
  useEffect(() => {
    submissionIdRef.current = submissionId;
  }, [submissionId]);

  // Listener deteksi keluar aplikasi / swipe notification bar
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        step === 'answering' &&
        appState.current.match(/active/) &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        setIsLocked(true);
        if (submissionIdRef.current) {
          try {
            await lockSubmission(submissionIdRef.current, 'Keluar dari aplikasi (App background/inactive)');
          } catch (err) {
            console.error('Gagal mengunci kuis di server:', err);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [step]);

  const handleRefreshLockStatus = async () => {
    setIsCheckingLock(true);
    try {
      if (submissionId) {
        const detail = await getSubmissionDetail(submissionId);
        // Buka kuis jika status tidak terkunci dari server (misal diubah oleh admin di web jadi in_progress)
        if (detail.status !== 'locked') {
          setIsLocked(false);
          showAlert({
            type: 'success',
            title: language === 'ID' ? 'Kuis Dibuka Kembali' : 'Quiz Unlocked',
            message: language === 'ID'
              ? 'Pengawas / creator telah membuka kuis kamu. Kamu bisa melanjutkan pengerjaan.'
              : 'The proctor / creator has unlocked your quiz. You can continue.',
          });
        } else {
          showAlert({
            type: 'warning',
            title: language === 'ID' ? 'Masih Terkunci' : 'Still Locked',
            message: language === 'ID'
              ? 'Pengawas / creator belum membuka kuis kamu dari Web Admin.'
              : 'The proctor / creator has not unlocked your quiz yet.',
          });
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('Gagal mengecek status lock:', e);
    } finally {
      setIsCheckingLock(false);
    }
  };

  useEffect(() => {
    if (!shortCode && !formId) {
      setErrorMessage(
        language === 'ID'
          ? 'Token atau ID kuis tidak valid.'
          : 'Invalid quiz token or ID.'
      );
      setStep('error');
      return;
    }
    loadPublicForm();
  }, [shortCode, formId]);

  const loadPublicForm = async () => {
    setStep('loading');
    try {
      let codeToUse = shortCode || formId || '';
      if (codeToUse.includes('/q/')) {
        const parts = codeToUse.split('/q/');
        codeToUse = parts[parts.length - 1].split('/')[0].split('?')[0];
      }
      const data = await getPublicForm(codeToUse);
      setPublicForm(data);
      setStep('landing');
    } catch (e: any) {
      setErrorMessage(
        e.message ||
          (language === 'ID' ? 'Quiz / Form tidak ditemukan.' : 'Quiz / Form not found.')
      );
      setStep('error');
    }
  };

  const handleStartQuiz = async () => {
    if (!publicForm || !publicForm.id) return;
    setStarting(true);
    try {
      const res = await createSubmission(publicForm.id);
      const subId = res.submission_id || res.id;
      setSubmissionId(subId);
      submissionIdRef.current = subId;

      if (res.status === 'locked') {
        setIsLocked(true);
      }

      let qs = res.questions || [];
      let secList = res.sections || [];
      if (!qs || qs.length === 0 || !secList.length) {
        const detail = await getSubmissionDetail(subId);
        qs = detail.questions || qs;
        secList = detail.sections || secList;
      }
      setQuestions(qs);
      setSections(secList);

      const initialAnswers: Record<number, any> = {};
      if (res.answers) {
        res.answers.forEach((a: any) => {
          if (
            a.question_type === 'short_answer' ||
            a.question_type === 'essay' ||
            a.question_type === 'date' ||
            a.question_type === 'time'
          ) {
            initialAnswers[a.question_id] = a.answer_text || '';
          } else if (a.question_type === 'file_upload') {
            initialAnswers[a.question_id] = a.answer_file || '';
          } else {
            initialAnswers[a.question_id] = a.selected_option_ids || [];
          }
        });
      }
      setAnswers(initialAnswers);

      // Initialize Timer Countdown right after starting quiz
      const rawLimit = res.timer_seconds || res.expires_in || publicForm?.timer_seconds || publicForm?.time_limit || publicForm?.settings?.time_limit;
      if (rawLimit) {
        const sec = typeof rawLimit === 'number' && rawLimit < 500 ? rawLimit * 60 : Number(rawLimit);
        setTimeLeft(sec);
      } else if (res.expires_at) {
        const diffSec = Math.max(0, Math.floor((new Date(res.expires_at).getTime() - Date.now()) / 1000));
        setTimeLeft(diffSec);
      } else {
        // Default timer if form specifies countdown or default 98 mins
        setTimeLeft(5877);
      }

      setStep('answering');
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Gagal Memulai Kuis' : 'Failed to Start Quiz',
        message: e.message ||
          (language === 'ID'
            ? 'Terjadi kesalahan saat membuat sesi kuis.'
            : 'An error occurred while creating quiz session.'),
      });
    } finally {
      setStarting(false);
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (step !== 'answering' || timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [step, timeLeft]);

  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = useCallback((questionId: number, optionId: number, isCheckbox: boolean) => {
    if (step === 'submitted') return;

    setAnswers((prev) => {
      let newOptionIds: number[] = [];
      const currentAns = prev[questionId];

      if (isCheckbox) {
        const prevIds: number[] = Array.isArray(currentAns) ? currentAns : [];
        newOptionIds = prevIds.includes(optionId) ? prevIds.filter((id) => id !== optionId) : [...prevIds, optionId];
      } else {
        newOptionIds = [optionId];
      }

      // Non-blocking autosave API call
      if (submissionId) {
        autosaveAnswer(submissionId, { question_id: questionId, option_ids: newOptionIds }).catch((err) =>
          console.error('Autosave error', err)
        );
      }

      return { ...prev, [questionId]: newOptionIds };
    });
  }, [step, submissionId]);

  const handleTextChange = useCallback((questionId: number, text: string) => {
    setAnswers((prev) => {
      // Non-blocking autosave API call
      if (submissionId) {
        const qObj = (questions || []).find((q: any) => q.id === questionId);
        const qType = qObj?.type || qObj?.question_type;
        let shouldAutosave = true;

        if (qType === 'date' && text.trim().length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
          shouldAutosave = false;
        } else if (qType === 'time' && text.trim().length > 0 && !/^\d{2}:\d{2}$/.test(text.trim())) {
          shouldAutosave = false;
        }

        if (shouldAutosave) {
          autosaveAnswer(submissionId, { question_id: questionId, answer_text: text }).catch((err) =>
            console.error('Autosave error', err)
          );
        }
      }
      return { ...prev, [questionId]: text };
    });
  }, [submissionId, questions]);

  const handlePickAnswerFile = useCallback(async (questionId: number) => {
    if (!submissionId) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const fileUri = res.assets[0].uri;
        setFileUploading((prev) => ({ ...prev, [questionId]: true }));
        const upRes = await uploadAnswerFile(submissionId, questionId, fileUri);
        const savedUrl = upRes.url || upRes.answer_file || fileUri;
        setAnswers((prev) => ({ ...prev, [questionId]: savedUrl }));
      }
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Gagal Unggah' : 'Upload Failed',
        message: e.message || (language === 'ID' ? 'Gagal mengunggah file jawaban.' : 'Failed to upload answer file.'),
      });
    } finally {
      setFileUploading((prev) => ({ ...prev, [questionId]: false }));
    }
  }, [submissionId, language, showAlert]);

  const handleZoomQuestion = useCallback((questionToZoom: any) => {
    setZoomQuestionTarget(questionToZoom);
  }, []);

  const getUnansweredCount = () => {
    let count = 0;
    questions.forEach((q) => {
      if (q.is_required !== false) {
        const val = answers[q.id];
        const isFilled = Array.isArray(val) ? val.length > 0 : !!val && String(val).trim().length > 0;
        if (!isFilled) count++;
      }
    });
    return count;
  };

  const handleSubmit = async () => {
    if (!submissionId) return;
    const unansweredCount = getUnansweredCount();
    if (unansweredCount > 0) {
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Belum Selesai' : 'Incomplete',
        message: language === 'ID'
          ? `Masih ada ${unansweredCount} soal wajib yang belum dijawab.`
          : `There are still ${unansweredCount} required question(s) unanswered.`,
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await finalizeSubmission(submissionId);
      setResultData(res);
      setStep('submitted');
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Gagal Mengirim' : 'Submission Failed',
        message: e.message || (language === 'ID' ? 'Terjadi kesalahan saat mengirim jawaban.' : 'An error occurred while submitting answers.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Section Pagination States
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<number, boolean>>({});

  // Group questions into section pages (matching web AnswerQuiz.jsx)
  const formPages = React.useMemo(() => {
    if (!questions || questions.length === 0) return [];

    const ordered: any[] = [];
    const seen = new Set<number>();

    // 1. Order questions by section if sections array exists
    if (sections && sections.length > 0) {
      sections.forEach((s) => {
        questions
          .filter((q) => q.section_id === s.id && !seen.has(q.id))
          .forEach((q) => {
            ordered.push(q);
            seen.add(q.id);
          });
      });
    }

    // 2. Add remaining questions
    questions
      .filter((q) => !seen.has(q.id))
      .forEach((q) => {
        ordered.push(q);
        seen.add(q.id);
      });

    // 3. Group questions into pages by section_id
    const pages: { key: any; title: string | null; section: any; questions: any[] }[] = [];
    ordered.forEach((q) => {
      const secObj = (sections || []).find((s) => s.id === q.section_id);
      const title = secObj?.title || null;
      const key = q.section_id ?? 'none';

      const last = pages[pages.length - 1];
      if (last && last.key === key) {
        last.questions.push(q);
      } else {
        pages.push({ key, title, section: secObj || null, questions: [q] });
      }
    });

    return pages.length > 0 ? pages : [{ key: 'none', title: null, section: null, questions: ordered }];
  }, [questions, sections]);

  const currentPage = formPages[currentSectionIdx] || formPages[0] || { key: 'none', title: null, section: null, questions: [] };

  const isQuestionAnswered = (q: any, val: any) => {
    if (q?.type === 'file_upload') return !!val;
    if (Array.isArray(val)) return val.length > 0;
    return !!val && String(val).trim().length > 0;
  };

  const handleNextSection = () => {
    if (!currentPage) return;

    // Check missing required questions in current section page
    const missing = (currentPage.questions || []).filter(
      (q: any) => q.is_required !== false && !isQuestionAnswered(q, answers[q.id])
    );

    if (missing.length > 0) {
      const errs: Record<number, boolean> = {};
      missing.forEach((q: any) => {
        errs[q.id] = true;
      });
      setValidationErrors((prev) => ({ ...prev, ...errs }));
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Soal Wajib Belum Diisi' : 'Required Question Missing',
        message: language === 'ID'
          ? 'Lengkapi semua soal wajib di bagian ini sebelum berpindah halaman.'
          : 'Please complete all required questions in this section before proceeding.',
      });
      return;
    }

    setValidationErrors({});
    if (currentSectionIdx < formPages.length - 1) {
      setDirection(1);
      setCurrentSectionIdx((prev) => prev + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      handleSubmit();
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIdx > 0) {
      setDirection(-1);
      setCurrentSectionIdx((prev) => prev - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  // Smooth Slide & Fade-in AFTER new section has mounted + Progressive Question Batching
  useEffect(() => {
    setVisibleLimit(6);

    translateXAnim.setValue(direction * 40);
    fadeAnim.setValue(0.3);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateXAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // Render remaining questions in section after transition starts
    const timer = setTimeout(() => {
      setVisibleLimit(999);
    }, 60);

    return () => clearTimeout(timer);
  }, [currentSectionIdx, direction, fadeAnim, translateXAnim]);

  // Check unanswered count for current section page
  const currentSectionUnansweredCount = (currentPage?.questions || []).filter(
    (q: any) => q.is_required !== false && !isQuestionAnswered(q, answers[q.id])
  ).length;

  const themeColor = publicForm?.theme_color || publicForm?.color || publicForm?.themeColor || publicForm?.settings?.theme_color;
  const bannerPath = publicForm?.banner_path || null;

  // ── RENDER STATES ─────────────────────────────────

  if (step === 'loading') {
    return (
      <SafeAreaView style={[styles.centerScreen, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>
          {language === 'ID' ? 'Memuat kuis...' : 'Loading quiz...'}
        </Text>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={[styles.centerScreen, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.errorCircle, { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' }]}>
          <Ionicons name="alert-circle-outline" size={54} color="#EF4444" />
        </View>
        <Text style={[styles.errorTitle, { color: colors.text, fontSize: 20 * fontSizeScale }]}>
          {language === 'ID' ? 'Kuis Tidak Ditemukan' : 'Quiz Not Found'}
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>{errorMessage}</Text>
        <TouchableOpacity style={[styles.backHomeBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/(tabs)/home')}>
          <Ionicons name="arrow-back" size={18} color="#FFF" />
          <Text style={[styles.backHomeBtnText, { fontSize: 15 * fontSizeScale }]}>
            {language === 'ID' ? 'Kembali ke Dashboard' : 'Back to Dashboard'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (step === 'landing') {
    return <QuizLandingStep publicForm={publicForm} starting={starting} onStart={handleStartQuiz} />;
  }

  if (step === 'submitted') {
    return <QuizSubmittedStep resultData={resultData} />;
  }

  const formattedTimerStr = formatTimer(timeLeft);
  const displayStyle = publicForm?.display_style || 'card';

  if (displayStyle === 'quiz') {
    return (
      <View style={{ flex: 1 }}>
        {isLocked && (
          <LockOverlay
            onRefresh={handleRefreshLockStatus}
            isChecking={isCheckingLock}
          />
        )}
        <QuizStyleAnsweringStep
          publicForm={publicForm}
          questions={questions}
          answers={answers}
          onSelectOption={handleSelectOption}
          onTextChange={handleTextChange}
          onPickFile={handlePickAnswerFile}
          fileUploading={fileUploading}
          formattedTimerStr={formattedTimerStr}
          submitting={submitting}
          onSubmit={handleSubmit}
          onOpenZoom={(q) => setZoomQuestionTarget(q)}
          onCloseQuiz={() => router.replace('/(tabs)/home')}
        />
        {zoomQuestionTarget && (
          <QuestionZoomModal
            visible={!!zoomQuestionTarget}
            question={zoomQuestionTarget}
            index={questions.findIndex((q) => q.id === zoomQuestionTarget.id)}
            userAnswer={answers[zoomQuestionTarget.id]}
            isFileUploading={!!fileUploading[zoomQuestionTarget.id]}
            themeColor={themeColor}
            onSelectOption={handleSelectOption}
            onTextChange={handleTextChange}
            onPickFile={handlePickAnswerFile}
            onClose={() => setZoomQuestionTarget(null)}
          />
        )}
      </View>
    );
  }

  return (
    <QuizBackground themeColor={themeColor}>
      <SafeAreaView style={styles.answeringContainer}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Lock Overlay ketika terdeteksi keluar aplikasi / swipe bar notifikasi */}
        {isLocked && (
          <LockOverlay
            onRefresh={handleRefreshLockStatus}
            isChecking={isCheckingLock}
          />
        )}

        {/* Top Header Bar */}
        <View style={[styles.topBar, { backgroundColor: colors.cardBg, borderBottomColor: colors.inputBorder }]}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/home')}>
            <Ionicons name="close-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={[styles.topBarTitle, { color: colors.text, fontSize: 16 * fontSizeScale }]} numberOfLines={1}>
              {stripHtmlTags(publicForm?.title) || (language === 'ID' ? 'Kuis' : 'Quiz')}
            </Text>
            <Text style={[styles.topBarSub, { color: colors.textSub, fontSize: 11 * fontSizeScale }]}>
              {questions.length} {language === 'ID' ? 'SOAL' : 'QUESTIONS'}
            </Text>
          </View>
        </View>

        {/* Scrollable Answering Container with Keyboard Avoidance & Smooth Section Animation */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: translateXAnim }], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
                {/* Banner Image (if present) */}
                {bannerPath && (
                  <Image source={{ uri: bannerPath }} style={styles.formBannerImg} resizeMode="cover" />
                )}

                {/* Quiz Title & Header Badges (Matching Web Screenshot) */}
                <View style={styles.formHeaderRow}>
                  <Text style={[styles.formTitleText, { color: colors.text }]}>
                    {stripHtmlTags(publicForm?.title) || 'Quiz'}
                  </Text>
                  <View style={styles.formMetaBadgesRow}>
                    {/* Timer Badge (if active) */}
                    {formattedTimerStr && (
                      <View style={[styles.metaPillBadge, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#E2E8F0' }]}>
                        <Ionicons name="timer-outline" size={14} color={colors.text} />
                        <Text style={[styles.metaPillText, { color: colors.text }]}>{formattedTimerStr}</Text>
                      </View>
                    )}

                    {/* Question Count Badge */}
                    <View style={[styles.metaPillBadge, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#E2E8F0' }]}>
                      <Text style={[styles.metaPillText, { color: colors.textSub }]}>{questions.length} QUESTIONS</Text>
                    </View>
                  </View>
                </View>

                {/* Section Indicator Row (Matching Web Screenshot) */}
                {(() => {
                  const secTitle = currentPage?.title || currentPage?.section?.title || (formPages.length > 1 ? (language === 'ID' ? `Bagian ${currentSectionIdx + 1}` : `Section ${currentSectionIdx + 1}`) : null);
                  if (!secTitle && formPages.length <= 1) return null;
                  return (
                    <View style={styles.sectionHeaderRow}>
                      <View style={[styles.sectionPillIndicator, { backgroundColor: themeColor || colors.primary }]} />
                      <Text style={[styles.sectionTitleText, { color: colors.text }]} numberOfLines={1}>
                        {secTitle || (language === 'ID' ? `Bagian ${currentSectionIdx + 1}` : `Section ${currentSectionIdx + 1}`)}
                      </Text>
                      <Text style={[styles.sectionStepText, { color: colors.textSub }]}>
                        {currentSectionIdx + 1}/{formPages.length}
                      </Text>
                    </View>
                  );
                })()}

                {/* Questions of current section page (Progressive rendering for super-fast section switching) */}
                {(currentPage?.questions || []).slice(0, visibleLimit).map((q: any, idx: number) => {
                  const globalIdx = questions.findIndex((item) => item.id === q.id);
                  const qIndex = globalIdx >= 0 ? globalIdx : idx;

                  return (
                    <QuizQuestionCard
                      key={q.id || idx}
                      question={q}
                      index={qIndex}
                      userAnswer={answers[q.id]}
                      isFileUploading={!!fileUploading[q.id]}
                      themeColor={themeColor}
                      hasError={!!validationErrors[q.id]}
                      onZoomQuestion={handleZoomQuestion}
                      onSelectOption={handleSelectOption}
                      onTextChange={handleTextChange}
                      onPickFile={handlePickAnswerFile}
                    />
                  );
                })}
              </Animated.View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Per-Question Zoom Modal (Mounted only when target is selected) */}
        {!!zoomQuestionTarget && (
          <QuestionZoomModal
            visible={!!zoomQuestionTarget}
            question={zoomQuestionTarget}
            index={questions.findIndex((q) => q.id === zoomQuestionTarget?.id)}
            userAnswer={zoomQuestionTarget ? answers[zoomQuestionTarget.id] : null}
            isFileUploading={zoomQuestionTarget ? !!fileUploading[zoomQuestionTarget.id] : false}
            themeColor={themeColor}
            onClose={() => setZoomQuestionTarget(null)}
            onSelectOption={handleSelectOption}
            onTextChange={handleTextChange}
            onPickFile={handlePickAnswerFile}
          />
        )}

        {/* Bottom Navigation & Submit Bar */}
        <View style={[styles.bottomBarContainer, { backgroundColor: colors.cardBg, borderTopColor: colors.inputBorder }]}>
          {currentSectionUnansweredCount > 0 && (
            <View style={styles.unansweredBanner}>
              <Ionicons name="alert-circle" size={16} color="#F59E0B" />
              <Text style={[styles.unansweredText, { fontSize: 12 * fontSizeScale }]}>
                {language === 'ID'
                  ? `${currentSectionUnansweredCount} soal wajib di bagian ini belum dijawab`
                  : `${currentSectionUnansweredCount} required question(s) left in this section`}
              </Text>
            </View>
          )}

          <View style={styles.bottomNavRow}>
            {currentSectionIdx > 0 && (
              <TouchableOpacity
                style={[styles.prevButton, { borderColor: colors.inputBorder, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F1F5F9' }]}
                onPress={handlePrevSection}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
                <Text style={[styles.prevButtonText, { color: colors.text }]}>
                  {language === 'ID' ? 'Kembali' : 'Previous'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                { flex: 1, backgroundColor: currentSectionUnansweredCount > 0 && currentSectionIdx === formPages.length - 1 ? '#64748B' : (themeColor || colors.primary) },
              ]}
              onPress={handleNextSection}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.submitButtonText, { fontSize: 16 * fontSizeScale }]}>
                    {currentSectionIdx < formPages.length - 1
                      ? (language === 'ID' ? 'Lanjut' : 'Next')
                      : (currentSectionUnansweredCount > 0
                          ? (language === 'ID' ? 'Lengkapi Jawaban' : 'Complete Answers')
                          : (language === 'ID' ? 'Kirim Jawaban' : 'Submit Answers'))}
                  </Text>
                  {currentSectionIdx < formPages.length - 1 && (
                    <Ionicons name="chevron-forward" size={18} color="#FFF" />
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </QuizBackground>
  );
}

const styles = StyleSheet.create({
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontWeight: '600' },
  errorCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorTitle: { fontWeight: 'bold', marginBottom: 6 },
  errorDesc: { textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  backHomeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  backHomeBtnText: { color: '#FFF', fontWeight: 'bold' },

  answeringContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  topBarTitle: { fontWeight: 'bold' },
  topBarSub: { fontWeight: '700', letterSpacing: 0.8 },

  formBannerImg: { width: '100%', height: 160, borderRadius: 18, marginBottom: 16 },
  formHeaderRow: { marginBottom: 16 },
  formTitleText: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  formMetaBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaPillBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  timerPillBadge: { paddingHorizontal: 12, paddingVertical: 6 },
  metaPillText: { fontSize: 12, fontWeight: '700' },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionPillIndicator: {
    width: 4,
    height: 22,
    borderRadius: 2,
  },
  sectionTitleText: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionStepText: {
    fontSize: 14,
    fontWeight: '700',
  },

  bottomBarContainer: { padding: 16, borderTopWidth: 1, gap: 10 },
  bottomNavRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  prevButtonText: { fontWeight: '700', fontSize: 15 },
  unansweredBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  unansweredText: { color: '#F59E0B', fontWeight: 'bold' },
  submitButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold' },
});