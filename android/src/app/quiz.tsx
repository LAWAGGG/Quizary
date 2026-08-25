import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
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
} from '../services/api_service';
import { useAppTheme } from '../context/ThemeContext';
import { QuizLandingStep } from '../components/quiz/QuizLandingStep';
import { QuizQuestionCard } from '../components/quiz/QuizQuestionCard';
import { QuizSubmittedStep } from '../components/quiz/QuizSubmittedStep';

export default function StandaloneQuizScreen() {
  const { colors, isDark } = useAppTheme();
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

  useEffect(() => {
    if (!shortCode && !formId) {
      setErrorMessage('Token atau ID kuis tidak valid.');
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
      setErrorMessage(e.message || 'Quiz / Form tidak ditemukan.');
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

      let qs = res.questions || [];
      if (!qs || qs.length === 0) {
        const detail = await getSubmissionDetail(subId);
        qs = detail.questions || [];
      }
      setQuestions(qs);

      const initialAnswers: Record<number, any> = {};
      if (res.answers) {
        res.answers.forEach((a: any) => {
          if (a.question_type === 'short_answer' || a.question_type === 'essay' || a.question_type === 'date' || a.question_type === 'time') {
            initialAnswers[a.question_id] = a.answer_text || '';
          } else if (a.question_type === 'file_upload') {
            initialAnswers[a.question_id] = a.answer_file || '';
          } else {
            initialAnswers[a.question_id] = a.selected_option_ids || [];
          }
        });
      }
      setAnswers(initialAnswers);
      setStep('answering');
    } catch (e: any) {
      Alert.alert('Gagal Memulai Kuis', e.message || 'Terjadi kesalahan saat membuat sesi kuis.');
    } finally {
      setStarting(false);
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

    setAnswers((prev) => ({ ...prev, [questionId]: newOptionIds }));

    if (submissionId) {
      try {
        await autosaveAnswer(submissionId, { question_id: questionId, option_ids: newOptionIds });
      } catch (err) {
        console.error('Autosave error', err);
      }
    }
  };

  const handleTextChange = async (questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
    if (submissionId) {
      try {
        await autosaveAnswer(submissionId, { question_id: questionId, answer_text: text });
      } catch (err) {
        console.error('Autosave error', err);
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
        setAnswers((prev) => ({ ...prev, [questionId]: savedUrl }));
      }
    } catch (e: any) {
      Alert.alert('Gagal Unggah', e.message || 'Gagal mengunggah file jawaban.');
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
      Alert.alert('Belum Selesai', `Masih ada ${unansweredCount} soal wajib yang belum dijawab.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await finalizeSubmission(submissionId);
      setResultData(res);
      setStep('submitted');
    } catch (e: any) {
      Alert.alert('Gagal Mengirim', e.message || 'Terjadi kesalahan saat mengirim jawaban.');
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
        <Text style={[styles.loadingText, { color: colors.textSub }]}>Memuat kuis...</Text>
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
        <Text style={[styles.errorTitle, { color: colors.text }]}>Kuis Tidak Ditemukan</Text>
        <Text style={[styles.errorDesc, { color: colors.textSub }]}>{errorMessage}</Text>
        <TouchableOpacity style={[styles.backHomeBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/(tabs)/home')}>
          <Ionicons name="arrow-back" size={18} color="#FFF" />
          <Text style={styles.backHomeBtnText}>Kembali ke Dashboard</Text>
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

      {/* Top Header */}
      <View style={[styles.topBar, { backgroundColor: colors.cardBg, borderBottomColor: colors.inputBorder }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')}>
          <Ionicons name="close-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>{publicForm?.title || 'Kuis'}</Text>
          <Text style={[styles.topBarSub, { color: colors.textSub }]}>{questions.length} SOAL</Text>
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
            <Text style={styles.unansweredText}>{unansweredCount} soal wajib belum dijawab</Text>
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
            <Text style={styles.submitButtonText}>
              {unansweredCount > 0 ? 'Lengkapi Jawaban' : 'Kirim Jawaban'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '600' },
  errorCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  errorDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  backHomeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  backHomeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  answeringContainer: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  topBarTitle: { fontSize: 16, fontWeight: 'bold' },
  topBarSub: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  bottomBarContainer: { padding: 16, borderTopWidth: 1, gap: 10 },
  unansweredBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  unansweredText: { color: '#F59E0B', fontSize: 12, fontWeight: 'bold' },
  submitButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
