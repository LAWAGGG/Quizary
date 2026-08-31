import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPublicForm,
  createSubmission,
  autosaveAnswer,
  finalizeSubmission,
  getSubmissionDetail,
  uploadAnswerFile,
} from '../services/api_service';
import { useAppTheme } from '../context/ThemeContext';
import { stripHtmlTags } from '../components/RichTextRenderer';
import { QuizLandingStep } from '../components/quiz/QuizLandingStep';
import { QuizQuestionCard } from '../components/quiz/QuizQuestionCard';
import { QuizSubmittedStep } from '../components/quiz/QuizSubmittedStep';
import LockOverlay from '../components/quiz/LockOverlay';

export default function StandaloneQuizScreen() {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const { shortCode, formId } = useLocalSearchParams<{ shortCode?: string; formId?: string }>();

  // Data states
  const [publicForm, setPublicForm] = useState<any>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [fileUploading, setFileUploading] = useState<Record<number, boolean>>({});

  // Flow states
  const [step, setStep] = useState<'loading' | 'landing' | 'answering' | 'submitted' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // Anti-cheat & Lock states
  const [isLocked, setIsLocked] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(false);
  const appState = useRef(AppState.currentState);

  // KEY LOCAL STORAGE UNTUK DRAFT JAWABAN
  const getStorageKey = (subId?: number | null) => {
    const identifier = subId || formId || shortCode || 'temp';
    return `quiz_draft_${identifier}`;
  };

  // Listener deteksi keluar aplikasi / swipe notification bar
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        step === 'answering' &&
        appState.current.match(/active/) &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        setIsLocked(true);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [step]);

  // Tombol Refresh: Cek apakah creator sudah mengubah status di Web (dari Locked ke In Progress / Cheating)
  const handleRefreshLockStatus = async () => {
    setIsCheckingLock(true);
    try {
      if (submissionId) {
        const detail = await getSubmissionDetail(submissionId);
        const currentStatus = String(detail.status).toLowerCase();
        
        // SKENARIO 1: Creator mengubah status ke "in_progress" atau "active" -> Buka kunci & Lanjutkan!
        if (currentStatus === 'in_progress' || currentStatus === 'in progress' || currentStatus === 'active' || currentStatus === 'unlocked') {
          const storageKey = getStorageKey(submissionId);
          const savedAnswers = await AsyncStorage.getItem(storageKey);
          if (savedAnswers) {
            setAnswers(JSON.parse(savedAnswers));
          }
          setIsLocked(false);
        } 
        // SKENARIO 2: Creator mengubah status ke "cheating", "submitted", atau "terminated" -> Hentikan Ujian!
        else if (currentStatus === 'cheating' || currentStatus === 'submitted' || currentStatus === 'terminated' || currentStatus === 'rejected') {
          setIsLocked(false);
          const storageKey = getStorageKey(submissionId);
          await AsyncStorage.removeItem(storageKey);
          setResultData(detail);
          setStep('submitted');
          Alert.alert(
            language === 'ID' ? 'Ujian Diakhiri' : 'Exam Terminated',
            language === 'ID'
              ? 'Pengawas telah menandai pengerjaan kamu sebagai Cheating / Dihentikan.'
              : 'The proctor has marked your exam as Cheating / Terminated.'
          );
        } 
        // SKENARIO 3: Masih status "locked" di web
        else {
          Alert.alert(
            language === 'ID' ? 'Masih Terkunci' : 'Still Locked',
            language === 'ID'
              ? 'Pengawas belum mengubah status kuis kamu ke "In Progress". Silakan minta pengawas membuka kuis di web.'
              : 'The proctor has not set your status to "In Progress" yet.'
          );
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

      const status = String(res.status).toLowerCase();

      // JIKA SUBMISSION SUDAH DI-SUBMIT ATAU DI-SET CHEATING DARI AWAL
      if (status === 'submitted' || status === 'completed' || status === 'cheating') {
        const detail = await getSubmissionDetail(subId);
        setResultData(detail);
        setStep('submitted');
        return;
      }

      // JIKA DARI WEBPAGE MASIH DALAM KONDISI LOCKED
      if (status === 'locked') {
        setIsLocked(true);
      }

      let qs = res.questions || [];
      if (!qs || qs.length === 0) {
        const detail = await getSubmissionDetail(subId);
        qs = detail.questions || [];
      }
      setQuestions(qs);

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

      // Load draft lokal jika siswa melanjutkan pengerjaan ("In Progress")
      const storageKey = getStorageKey(subId);
      const savedLocal = await AsyncStorage.getItem(storageKey);
      
      let mergedAnswers = initialAnswers;
      if (savedLocal) {
        mergedAnswers = { ...initialAnswers, ...JSON.parse(savedLocal) };
      }

      setAnswers(mergedAnswers);
      await AsyncStorage.setItem(storageKey, JSON.stringify(mergedAnswers));

      setStep('answering');
    } catch (e: any) {
      Alert.alert(
        language === 'ID' ? 'Gagal Memulai Kuis' : 'Failed to Start Quiz',
        e.message ||
          (language === 'ID'
            ? 'Terjadi kesalahan saat membuat sesi kuis.'
            : 'An error occurred while creating quiz session.')
      );
    } finally {
      setStarting(false);
    }
  };

  const saveAnswerToLocalStorage = async (updatedAnswers: Record<number, any>) => {
    try {
      const storageKey = getStorageKey(submissionId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedAnswers));
    } catch (err) {
      console.error('Gagal menyimpan ke AsyncStorage:', err);
    }
  };

  const handleSelectOption = async (questionId: number, optionId: number, isCheckbox: boolean) => {
    if (step === 'submitted') return;

    let newOptionIds: number[] = [];
    const currentAns = answers[questionId];

    if (isCheckbox) {
      const prevIds: number[] = Array.isArray(currentAns) ? currentAns : [];
      newOptionIds = prevIds.includes(optionId) ? prevIds.filter((id) => id !== optionId) : [...prevIds, optionId];
    } else {
      newOptionIds = [optionId];
    }

    const updatedAnswers = { ...answers, [questionId]: newOptionIds };
    setAnswers(updatedAnswers);
    await saveAnswerToLocalStorage(updatedAnswers);

    if (submissionId) {
      try {
        await autosaveAnswer(submissionId, { question_id: questionId, option_ids: newOptionIds });
      } catch (err: any) {
        if (err.message?.includes('already completed')) {
          setStep('submitted');
        }
      }
    }
  };

  const handleTextChange = async (questionId: number, text: string) => {
    const updatedAnswers = { ...answers, [questionId]: text };
    setAnswers(updatedAnswers);
    await saveAnswerToLocalStorage(updatedAnswers);

    if (submissionId) {
      try {
        await autosaveAnswer(submissionId, { question_id: questionId, answer_text: text });
      } catch (err: any) {
        if (err.message?.includes('already completed')) {
          setStep('submitted');
        }
      }
    }
  };

  const handlePickAnswerFile = async (questionId: number) => {
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
        
        const updatedAnswers = { ...answers, [questionId]: savedUrl };
        setAnswers(updatedAnswers);
        await saveAnswerToLocalStorage(updatedAnswers);
      }
    } catch (e: any) {
      Alert.alert(
        language === 'ID' ? 'Gagal Unggah' : 'Upload Failed',
        e.message || (language === 'ID' ? 'Gagal mengunggah file jawaban.' : 'Failed to upload answer file.')
      );
    } finally {
      setFileUploading((prev) => ({ ...prev, [questionId]: false }));
    }
  };

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
      Alert.alert(
        language === 'ID' ? 'Belum Selesai' : 'Incomplete',
        language === 'ID'
          ? `Masih ada ${unansweredCount} soal wajib yang belum dijawab.`
          : `There are still ${unansweredCount} required question(s) unanswered.`
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await finalizeSubmission(submissionId);
      setResultData(res);
      setStep('submitted');

      const storageKey = getStorageKey(submissionId);
      await AsyncStorage.removeItem(storageKey);
    } catch (e: any) {
      Alert.alert(
        language === 'ID' ? 'Gagal Mengirim' : 'Submission Failed',
        e.message || (language === 'ID' ? 'Terjadi kesalahan saat mengirim jawaban.' : 'An error occurred while submitting answers.')
      );
    } finally {
      setSubmitting(false);
    }
  };

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

  // Answering Screen
  const unansweredCount = getUnansweredCount();

  return (
    <SafeAreaView style={[styles.answeringContainer, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Lock Overlay saat terdeteksi melanggar / status locked */}
      {isLocked && (
        <LockOverlay
          onRefresh={handleRefreshLockStatus}
          isChecking={isCheckingLock}
        />
      )}

      {/* Top Header */}
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

      {/* Questions Scroll */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {questions.map((q, idx) => (
          <QuizQuestionCard
            key={q.id || idx}
            question={q}
            index={idx}
            userAnswer={answers[q.id]}
            isFileUploading={!!fileUploading[q.id]}
            onSelectOption={handleSelectOption}
            onTextChange={handleTextChange}
            onPickFile={handlePickAnswerFile}
          />
        ))}
      </ScrollView>

      {/* Bottom Submit Bar */}
      <View style={[styles.bottomBarContainer, { backgroundColor: colors.cardBg, borderTopColor: colors.inputBorder }]}>
        {unansweredCount > 0 && (
          <View style={styles.unansweredBanner}>
            <Ionicons name="alert-circle" size={16} color="#F59E0B" />
            <Text style={[styles.unansweredText, { fontSize: 12 * fontSizeScale }]}>
              {language === 'ID'
                ? `${unansweredCount} soal wajib belum dijawab`
                : `${unansweredCount} required question(s) left`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: unansweredCount > 0 ? '#64748B' : colors.primary }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.submitButtonText, { fontSize: 16 * fontSizeScale }]}>
              {unansweredCount > 0
                ? (language === 'ID' ? 'Lengkapi Jawaban' : 'Complete Answers')
                : (language === 'ID' ? 'Kirim Jawaban' : 'Submit Answers')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  topBarTitle: { fontWeight: 'bold' },
  topBarSub: { fontWeight: '700', letterSpacing: 0.8 },

  bottomBarContainer: { padding: 16, borderTopWidth: 1, gap: 10 },
  unansweredBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  unansweredText: { color: '#F59E0B', fontWeight: 'bold' },
  submitButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold' },
});