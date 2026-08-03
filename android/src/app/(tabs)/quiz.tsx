import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getPublicForm, createSubmission, autosaveAnswer, finalizeSubmission } from '../services/api_service';

export default function QuizScreen() {
  const { shortCode, formId } = useLocalSearchParams<{ shortCode: string, formId: string }>();
  const [quiz, setQuiz] = useState<any>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!shortCode && !formId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // Fetch quiz details
        // Note: the mock API might require a short_code to get public form
        // We assume getPublicForm returns the form object with questions
        let data: any;
        if (shortCode) {
           data = await getPublicForm(shortCode);
        } else {
           // Fallback if accessed via Library (using formId)
           // If we're logged in, we can fetch the form details. But getPublicForm might not work with formId directly.
           // For now, let's assume getPublicForm can handle it or we use the shortCode.
           // This is a simplified demo fallback.
           data = await getPublicForm(formId); 
        }
        
        setQuiz(data);

        // Start a submission session (as anonymous guest)
        if (data && data.id) {
           const subRes = await createSubmission(data.id);
           if (subRes && subRes.id || subRes.submission_id) {
              setSubmissionId(subRes.id || subRes.submission_id);
           }
        }
      } catch (e: any) {
        Alert.alert('Gagal load quiz', e.message || 'Token tidak valid atau server tidak tersedia.');
      } finally {
        setLoading(false);
      }
    })();
  }, [shortCode, formId]);

  const selectOption = async (qId: string, optId: string) => {
    if (submitted) return;
    
    // Optimistic UI update
    setAnswers(prev => ({ ...prev, [qId]: optId }));

    // Autosave to API if we have a submission ID
    if (submissionId) {
       try {
         await autosaveAnswer(submissionId, qId, [optId]);
       } catch (err) {
         console.error("Autosave failed", err);
       }
    }
  };

  const submit = async () => {
    if (!quiz || !submissionId) return;
    
    // Validate if all questions are answered
    // (Assuming quiz.questions exists)
    const questions = quiz.questions || [];
    const unanswered = questions.filter((q: any) => !answers[q.id]);
    if (unanswered.length > 0) {
      Alert.alert('Belum selesai', `Masih ada ${unanswered.length} soal yang belum dijawab.`);
      return;
    }

    try {
      await finalizeSubmission(submissionId);
      setSubmitted(true);
      Alert.alert('Berhasil! 🎉', 'Jawaban kamu sudah tersimpan dan terkirim.');
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Terjadi kesalahan saat mengirim jawaban. Coba lagi.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Memuat quiz...</Text>
      </View>
    );
  }

  if (!quiz) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.msg}>Quiz tidak tersedia</Text>
        <Text style={styles.subMsg}>Token yang dimasukkan tidak valid.</Text>
      </View>
    );
  }

  const questions = quiz.questions || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{quiz.title}</Text>
      <Text style={styles.subtitle}>{questions.length} pertanyaan</Text>

      {questions.map((q: any, idx: number) => (
        <View key={q.id} style={styles.questionBox}>
          <Text style={styles.questionNum}>Soal {idx + 1}</Text>
          <Text style={styles.question}>{q.question_text || q.text}</Text>
          {(q.options || []).map((opt: any) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.option,
                answers[q.id] === opt.id && styles.optionSelected,
                submitted && opt.is_correct && styles.optionCorrect,
              ]}
              onPress={() => selectOption(q.id, opt.id)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.optionText,
                answers[q.id] === opt.id && styles.optionTextSelected,
              ]}>
                {opt.option_text || opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {!submitted && (
        <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={styles.submitText}>Kirim Jawaban Akhir</Text>
        </TouchableOpacity>
      )}

      {submitted && (
        <View style={styles.doneBox}>
          <Text style={styles.doneText}>✅ Jawaban sudah dikirim!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', gap: 8 },
  loadingText: { color: '#94A3B8', marginTop: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  msg: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  subMsg: { color: '#94A3B8' },
  title: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  questionNum: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  questionBox: { marginBottom: 20, backgroundColor: '#1E293B', padding: 16, borderRadius: 12 },
  question: { color: '#FFF', fontSize: 16, marginBottom: 12, lineHeight: 22 },
  option: { backgroundColor: '#334155', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  optionSelected: { backgroundColor: '#1D4ED8', borderColor: '#3B82F6' },
  optionCorrect: { backgroundColor: '#065F46', borderColor: '#10B981' },
  optionText: { color: '#CBD5E1', fontSize: 14 },
  optionTextSelected: { color: '#FFF', fontWeight: '600' },
  submitBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  doneBox: { backgroundColor: '#065F46', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  doneText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
