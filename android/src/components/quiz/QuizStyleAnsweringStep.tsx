import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { useAppAlert } from '../../context/AlertContext';
import { RichTextRenderer, stripHtmlTags } from '../RichTextRenderer';
import { extractImgUrl } from './QuizQuestionCard';
import { AudioPlayer } from '../AudioPlayer';
import { isAudioUrl, getQuestionImageUrl, getQuestionAudioUrl } from '../../utils/media';
import { CustomDateTimePickerModal } from './CustomDateTimePickerModal';
import { checkPassword } from '../../services/api_service';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

interface QuizStyleAnsweringStepProps {
  publicForm: any;
  questions: any[];
  answers: Record<number, any>;
  onSelectOption: (questionId: number, optionId: number, isCheckbox: boolean) => void;
  onTextChange: (questionId: number, text: string) => void;
  onPickFile: (questionId: number) => void;
  fileUploading: Record<number, boolean>;
  formattedTimerStr: string | null;
  submitting: boolean;
  onSubmit: () => void;
  onOpenZoom: (question: any) => void;
  onCloseQuiz: () => void;
  submissionId?: string | number | null;
  respondentName?: string | null;
  respondentEmail?: string | null;
}

const OPT_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function QuizStyleAnsweringStep({
  publicForm,
  questions,
  answers,
  onSelectOption,
  onTextChange,
  onPickFile,
  fileUploading,
  formattedTimerStr,
  submitting,
  onSubmit,
  onOpenZoom,
  onCloseQuiz,
  submissionId,
  respondentName,
  respondentEmail,
}: QuizStyleAnsweringStepProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const { showAlert } = useAppAlert();
  const [showPassword, setShowPassword] = useState(false);
  const [pwWrong, setPwWrong] = useState<Record<number, boolean>>({});
  const [pwChecking, setPwChecking] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  const mainScrollRef = useRef<ScrollView>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const { keyboardHeight, isVisible: isKeyboardOpen } = useKeyboardHeight();

  // Reset scroll to top on question change
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentIdx]);
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  const [showMapModal, setShowMapModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [showPicker, setShowPicker] = useState<{ qId: number; mode: 'date' | 'time' | 'datetime' } | null>(null);
  const [showDropdownModal, setShowDropdownModal] = useState<number | null>(null);

  const openPicker = (qId: number, mode: 'date' | 'time' | 'datetime') => {
    setShowPicker({ qId, mode });
  };

  const themeColor =
    publicForm?.theme_color ||
    publicForm?.color ||
    publicForm?.themeColor ||
    publicForm?.settings?.theme_color ||
    colors.primary;

  // Animation values for ultra-smooth hardware-accelerated 1-by-1 question transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isTransitioningRef = useRef(false);
  const pendingDirRef = useRef<number>(1);

  const totalQ = questions.length;
  const currentQ = questions[currentIdx] || questions[0];

  // Exam info modal — paritas web ExamInfoDrawer (AnswerQuiz.jsx):
  // waktu dari timer_seconds (fallback time_limit), submission once/unlimited.
  const infoTotalMinutes = publicForm?.timer_seconds
    ? Math.ceil(publicForm.timer_seconds / 60)
    : (publicForm?.time_limit || publicForm?.duration || publicForm?.settings?.time_limit);
  const infoTimeStr = infoTotalMinutes
    ? (language === 'ID' ? `${infoTotalMinutes} menit` : `${infoTotalMinutes} minutes`)
    : (language === 'ID' ? 'Tanpa batas' : 'No limit');
  const infoSubmissionStr = publicForm?.submission_limit === 'once'
    ? (language === 'ID' ? 'Sekali saja' : 'Once only')
    : (language === 'ID' ? 'Tidak terbatas' : 'Unlimited');

  const infoRow = (label: string, value?: string | number | null) => (
    <View style={styles.infoRow} key={label}>
      <Text style={[styles.infoRowLabel, { color: colors.textSub }]}>{label}</Text>
      <Text style={[styles.infoRowValue, { color: colors.text }]} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );

  const animateToQuestion = (newIdx: number, dir: number) => {
    if (isTransitioningRef.current || newIdx === currentIdx) return;
    if (newIdx < 0 || newIdx >= questions.length) return;

    isTransitioningRef.current = true;
    pendingDirRef.current = dir;

    // Reset scroll offset immediately to top
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });

    // Initial entrance values: soft opacity (0.35), subtle offset (dir * 40), subtle scale (0.98)
    slideAnim.setValue(dir * 40);
    scaleAnim.setValue(0.98);
    fadeAnim.setValue(0.35);

    // Update index immediately to new question
    setCurrentIdx(newIdx);

    // Animate smoothly to resting state on native thread (240ms)
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isTransitioningRef.current = false;
      });
    });
  };

  const isAnswered = (q: any, val: any) => {
    if (q?.type === 'file_upload' || q?.question_type === 'file_upload') return !!val;
    if (Array.isArray(val)) return val.length > 0;
    return !!val && String(val).trim().length > 0;
  };

  const toggleReview = (qId: number) => {
    setReviewed((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const verifiedPwCacheRef = useRef<Record<number, string>>({});

  const verifySinglePassword = async (q: any, inputAns: string): Promise<boolean> => {
    const trimmed = inputAns.trim();
    if (!trimmed) return false;

    // 1. Cache hit (already verified once)
    if (verifiedPwCacheRef.current[q.id] === trimmed) {
      return true;
    }

    // 2. Local schema match check
    const localPw = q?.password || q?.correct_answer || q?.answer || q?.settings?.password || q?.meta?.password;
    if (localPw && String(localPw).trim() === trimmed) {
      verifiedPwCacheRef.current[q.id] = trimmed;
      return true;
    }

    // 3. Fallback API check
    if (!submissionId) return false;
    try {
      const res = await checkPassword(submissionId, q.id, trimmed);
      if (res && res.valid) {
        verifiedPwCacheRef.current[q.id] = trimmed;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const checkPasswordForQuestions = async (qs: any[]): Promise<number[]> => {
    // untuk quiz: semua password jadi gate — kosong pun salah (token hahay OPTIONAL tetap harus benar untuk Next)
    const targets = qs.filter((q) => String(q.type || q.question_type || '').toLowerCase() === 'password');
    if (!targets.length) return [];

    const wrong: number[] = [];
    for (const q of targets) {
      const ans = String(answers[q.id] ?? '');
      if (!ans.trim()) { wrong.push(q.id); continue; }
      const isValid = await verifySinglePassword(q, ans);
      if (!isValid) wrong.push(q.id);
    }
    return wrong;
  };

  const checkRequiredAndSubmit = async () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const isRequired = q.is_required !== false;
      const val = answers[q.id];
      if (isRequired && !isAnswered(q, val)) {
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Soal Wajib Belum Diisi' : 'Required Question Missing',
          message:
            language === 'ID'
              ? `Soal nomor ${i + 1} (wajib) belum diisi. Mohon lengkapi semua soal wajib sebelum mengirim.`
              : `Question #${i + 1} (required) is not answered. Please complete all required questions before submitting.`,
        });
        if (i !== currentIdx) {
          animateToQuestion(i, i > currentIdx ? 1 : -1);
        }
        return;
      }
    }
    // password gate on submit: semua password required harus valid
    setPwChecking(true);
    const wrongIds = await checkPasswordForQuestions(questions);
    setPwChecking(false);
    if (wrongIds.length) {
      const errs: Record<number, boolean> = {};
      wrongIds.forEach((id) => (errs[id] = true));
      setPwWrong((p) => ({ ...p, ...errs }));
      const firstIdx = questions.findIndex((q) => wrongIds.includes(q.id));
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Password salah' : 'Wrong password',
        message: language === 'ID' ? 'Password soal wajib belum benar. Periksa kembali.' : 'Password for required question is incorrect.',
      });
      if (firstIdx >= 0 && firstIdx !== currentIdx) animateToQuestion(firstIdx, firstIdx > currentIdx ? 1 : -1);
      return;
    }
    setPwWrong({});
    onSubmit();
  };

  const handleNext = async () => {
    if (!currentQ) return;
    // Gate password: semua password (termasuk OPTIONAL seperti token hahay) wajib benar untuk Next
    const t = String(currentQ.type || currentQ.question_type || '').toLowerCase();
    if (t === 'password') {
      const ans = String(answers[currentQ.id] ?? '');
      if (!ans.trim()) {
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Password wajib' : 'Password required',
          message: language === 'ID' ? 'Isi password sebelum lanjut ke soal berikutnya.' : 'Enter password before next question.',
        });
        setPwWrong((p) => ({ ...p, [currentQ.id]: true }));
        return;
      }
      if (!submissionId && !currentQ?.password && !currentQ?.correct_answer) {
        setPwWrong((p) => ({ ...p, [currentQ.id]: true }));
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Password wajib diverifikasi' : 'Password must be verified',
          message: language === 'ID' ? 'Tunggu sesi siap lalu coba lagi.' : 'Wait for session then try again.',
        });
        return;
      }

      // Quick check: cache or local schema match first without triggering loading spinner
      const isLocallyValid =
        verifiedPwCacheRef.current[currentQ.id] === ans.trim() ||
        (Boolean(currentQ.password || currentQ.correct_answer || currentQ.answer || currentQ.settings?.password) &&
          String(currentQ.password || currentQ.correct_answer || currentQ.answer || currentQ.settings?.password).trim() === ans.trim());

      let isValid = isLocallyValid;
      if (!isValid) {
        setPwChecking(true);
        isValid = await verifySinglePassword(currentQ, ans);
        setPwChecking(false);
      } else {
        verifiedPwCacheRef.current[currentQ.id] = ans.trim();
      }

      if (!isValid) {
        setPwWrong((p) => ({ ...p, [currentQ.id]: true }));
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Password salah' : 'Wrong password',
          message: language === 'ID' ? 'Password tidak cocok. Tidak bisa lanjut.' : 'Wrong password. Cannot proceed.',
        });
        return;
      }

      setPwWrong((p) => {
        const n = { ...p };
        delete n[currentQ.id];
        return n;
      });
    }

    if (currentIdx < totalQ - 1) {
      animateToQuestion(currentIdx + 1, 1);
    } else {
      await checkRequiredAndSubmit();
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      animateToQuestion(currentIdx - 1, -1);
    }
  };

  const progressPct = totalQ > 0 ? Math.round(((currentIdx + 1) / totalQ) * 100) : 0;

  // Determine question type & available options
  const rawType = String(currentQ?.type || currentQ?.question_type || '').toLowerCase();
  const qOptions = currentQ?.options || currentQ?.choices || [];

  const isDropdownType = rawType === 'dropdown' || rawType === 'select';
  const isOptionType =
    (rawType === 'multiple_choice' ||
      rawType === 'checkbox' ||
      rawType === 'choice' ||
      (qOptions.length > 0 && !isDropdownType && !rawType.includes('date') && !rawType.includes('time') && !rawType.includes('essay') && !rawType.includes('file'))) &&
    !isDropdownType;

  const isDateType = rawType === 'date';
  const isTimeType = rawType === 'time';
  const isDatetimeType = rawType === 'datetime';
  const isPasswordType = rawType === 'password';
  const isShortAnswerType = rawType === 'short_answer';
  const isEssayType = rawType === 'essay' || rawType === 'long_text';
  const isFileUploadType = rawType === 'file_upload' || rawType === 'file';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : colors.bg }]} edges={['top']}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* TOP HEADER BAR — editorial solid, bukan gradient mengkilap AI */}
      <View style={[styles.headerBar, { backgroundColor: themeColor, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.14)' }]}>
        {/* Row 1: Info (i), Quiz Title, and Timer Pill */}
        <View style={[styles.headerRowTop, { position: 'relative', minHeight: 32, justifyContent: 'space-between', alignItems: 'center' }]}>
          <TouchableOpacity
            style={[styles.infoIconBtn, { zIndex: 10 }]}
            onPress={() => setShowInfoModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={{ position: 'absolute', left: 80, right: 80, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.headerQuizTitle, { fontSize: 15 * fontSizeScale, textAlign: 'center', marginHorizontal: 0 }]} numberOfLines={1}>
              {stripHtmlTags(publicForm?.title) || 'Kuis'}
            </Text>
          </View>

          <View style={[styles.headerRightGroup, { zIndex: 10 }]}>
            {formattedTimerStr ? (
              <View style={styles.timerBadge}>
                <Ionicons name="timer-outline" size={14} color="#FFF" />
                <Text style={styles.timerBadgeText}>{formattedTimerStr}</Text>
              </View>
            ) : null}

            {!publicForm?.is_restricted && (
              <TouchableOpacity style={styles.closeHeaderBtn} onPress={onCloseQuiz} activeOpacity={0.7}>
                <Ionicons name="close-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Row 2: Progress Slider Bar & Question Map Selector Pill */}
        <View style={styles.headerRowBottom}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <TouchableOpacity
            style={[styles.mapSelectorBtn, { backgroundColor: 'rgba(0,0,0,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }]}
            onPress={() => setShowMapModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="grid-outline" size={13} color="#FFF" />
            <Text style={styles.mapSelectorText}>
              {currentIdx + 1}/{totalQ}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN QUESTION CONTAINER — keyboard aware: behavior height on Android + dynamic padding */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={mainScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardOpen
              ? { justifyContent: 'flex-start', paddingBottom: 60 }
              : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.View
              style={[
                styles.questionCardWrapper,
                { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleAnim }] },
              ]}
            >
              {currentQ && (
                <View key={currentQ.id || currentIdx} style={styles.questionInnerContainer}>
                  {/* Top Metadata Row: Optional Badge & Mark for Review */}
                  <View style={styles.qMetaHeaderRow}>
                    <View style={{ flex: 1 }}>
                      {currentQ.is_required === false ? (
                        <View style={styles.optionalBadge}>
                          <Text style={styles.optionalText}>OPTIONAL</Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.reviewFlagBtn,
                        reviewed[currentQ.id]
                          ? styles.reviewFlagBtnActive
                          : { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.inputBg, borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : colors.inputBorder },
                      ]}
                      onPress={() => toggleReview(currentQ.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={reviewed[currentQ.id] ? 'bookmark' : 'bookmark-outline'}
                        size={14}
                        color={reviewed[currentQ.id] ? '#FFF' : (isDark ? '#94A3B8' : colors.textSub)}
                      />
                      <Text
                        style={[
                          styles.reviewFlagText,
                          { color: reviewed[currentQ.id] ? '#FFF' : (isDark ? '#94A3B8' : colors.textSub) },
                        ]}
                      >
                        {reviewed[currentQ.id] ? (language === 'ID' ? 'Ditandai' : 'Marked') : (language === 'ID' ? 'Tandai untuk ditinjau' : 'Mark for review')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Centered WYSIWYG Question Title — renders rich HTML with code-block background & KaTeX like web */}
                  <View style={[styles.qTitleCenterWrapper, { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 4 }]}>
                    <View style={{ flex: 1 }}>
                      <RichTextRenderer
                        html={currentQ.question_text || ''}
                        style={{ color: isDark ? '#FFFFFF' : colors.text, fontSize: 22 * fontSizeScale, fontWeight: '800', textAlign: 'center', lineHeight: Math.round(22 * fontSizeScale * 1.45) }}
                      />
                    </View>
                    {currentQ.is_required !== false ? (
                      <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 22 * fontSizeScale, lineHeight: Math.round(22 * fontSizeScale * 1.45) }}>*</Text>
                    ) : null}
                  </View>

                  {/* Question Media: image + audio — tampil keduanya jika ada (web parity) */}
                  {(() => {
                    const imageUrl = getQuestionImageUrl(currentQ) || (() => { const u = extractImgUrl(currentQ, currentQ?.question_text); return u && !isAudioUrl(u) ? u : null; })();
                    const audioUrl = getQuestionAudioUrl(currentQ) || (() => { const u = extractImgUrl(currentQ, currentQ?.question_text); return u && isAudioUrl(u) ? u : null; })();
                    if (!imageUrl && !audioUrl) return null;
                    return (
                      <>
                        {imageUrl && (
                          <TouchableOpacity
                            style={[styles.qImageContainer, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : colors.inputBg, borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.inputBorder }]}
                            onPress={() => onOpenZoom(currentQ)}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.qImageStyle}
                              resizeMode="contain"
                            />
                            <View style={styles.zoomBadgeOverlay}>
                              <Ionicons name="expand-outline" size={12} color="#FFF" />
                              <Text style={styles.zoomBadgeText}>Ketuk untuk Zoom</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        {audioUrl && (
                          <View style={{ marginTop: imageUrl ? 12 : 0, width: '100%' }}>
                            <AudioPlayer uri={audioUrl} themeColor={themeColor} />
                          </View>
                        )}
                      </>
                    );
                  })()}

                  {/* Zoom Button Pill */}
                  <View style={styles.zoomCenterWrapper}>
                    <TouchableOpacity
                      style={[styles.zoomPillBtn, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : colors.inputBg, borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : colors.inputBorder }]}
                      onPress={() => onOpenZoom(currentQ)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="search-outline" size={14} color={colors.textSub} />
                      <Text style={[styles.zoomPillText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                        {language === 'ID' ? 'Perbesar pertanyaan' : 'Zoom in on question'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Helper Text (Pick one answer / Pick all that apply) */}
                  {isOptionType && (
                    <Text style={[styles.helperText, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
                      {rawType === 'checkbox' ? (language === 'ID' ? 'Pilih semua yang sesuai' : 'Pick all that apply') : (language === 'ID' ? 'Pilih satu jawaban' : 'Pick one answer')}
                    </Text>
                  )}

                  {/* VIBRANT OPTION TILES (Multiple Choice, Checkbox) — audio per option */}
                  {isOptionType && (
                    <View style={styles.optionsListContainer}>
                      {qOptions.map((opt: any, i: number) => {
                        const userAns = answers[currentQ.id];
                        const selected = Array.isArray(userAns)
                          ? userAns.includes(opt.id)
                          : userAns === opt.id;
                        const bgCol = OPT_COLORS[i % OPT_COLORS.length];
                        const isCheckbox = rawType === 'checkbox';
                        const optImgUrl = extractImgUrl(opt, opt?.option_text || opt?.text);
                        const optIsAudio = isAudioUrl(optImgUrl);

                        return (
                          <TouchableOpacity
                            key={opt.id || i}
                            style={[
                              styles.optionTile,
                              { backgroundColor: bgCol, flexDirection: (optImgUrl && !optIsAudio) || optIsAudio ? 'column' : 'row', alignItems: (optImgUrl && !optIsAudio) || optIsAudio ? 'stretch' : 'center' },
                              selected && styles.optionTileSelected,
                            ]}
                            onPress={() => onSelectOption(currentQ.id, opt.id, isCheckbox)}
                            activeOpacity={0.85}
                          >
                            {optImgUrl && !optIsAudio ? (
                              <View style={{ width: '100%', gap: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                    {isCheckbox ? (
                                      <View style={[styles.checkboxBox, selected && { backgroundColor: bgCol, borderColor: bgCol }]}>
                                        {selected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                                      </View>
                                    ) : (
                                      <View style={styles.letterCircle}>
                                        <Text style={styles.letterText}>{LETTERS[i % LETTERS.length]}</Text>
                                      </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                      <RichTextRenderer
                                        html={opt.option_text || opt.text || ''}
                                        style={{ color: '#FFFFFF', fontSize: 16 * fontSizeScale, fontWeight: '600' }}
                                      />
                                    </View>
                                  </View>
                                  {selected && !isCheckbox && (
                                    <View style={styles.selectedBadgeCircle}>
                                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                    </View>
                                  )}
                                </View>
                                <Image
                                  source={{ uri: optImgUrl }}
                                  style={styles.optionImgLarge}
                                  resizeMode="contain"
                                />
                              </View>
                            ) : (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
                                {isCheckbox ? (
                                  <View style={[styles.checkboxBox, selected && { backgroundColor: bgCol, borderColor: bgCol }]}>
                                    {selected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                                  </View>
                                ) : (
                                  <View style={styles.letterCircle}>
                                    <Text style={styles.letterText}>{LETTERS[i % LETTERS.length]}</Text>
                                  </View>
                                )}

                                <View style={{ flex: 1 }}>
                                  <RichTextRenderer
                                    html={opt.option_text || opt.text || ''}
                                    style={{ color: '#FFFFFF', fontSize: 16 * fontSizeScale, fontWeight: '600' }}
                                  />
                                </View>

                                {selected && !isCheckbox && (
                                  <View style={styles.selectedBadgeCircle}>
                                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                  </View>
                                )}
                              </View>
                            )}
                            {optIsAudio && optImgUrl && (
                              <View style={{ marginTop: 12 }} onTouchEnd={(e: any) => e.stopPropagation?.()}>
                                <AudioPlayer uri={optImgUrl} themeColor="#FFF" compact />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* DROPDOWN SELECT INPUT */}
                  {isDropdownType && (() => {
                    const userAns = answers[currentQ.id];
                    const selectedOptId = Array.isArray(userAns) ? userAns[0] : userAns;
                    const selectedOpt = qOptions.find((opt: any) => opt.id === selectedOptId);
                    const selectedOptIdx = qOptions.findIndex((opt: any) => opt.id === selectedOptId);

                    return (
                      <View style={styles.dropdownWrapper}>
                        <TouchableOpacity
                          style={[
                            styles.dropdownTriggerBtn,
                            {
                              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#1E293B',
                              borderColor: selectedOpt ? '#3B82F6' : (isDark ? 'rgba(255, 255, 255, 0.15)' : '#475569'),
                            },
                          ]}
                          onPress={() => setShowDropdownModal(currentQ.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.dropdownTriggerText, { color: selectedOpt ? '#FFFFFF' : '#94A3B8', fontSize: 16 * fontSizeScale }]} numberOfLines={1} ellipsizeMode="tail">
                            {selectedOpt
                              ? stripHtmlTags(selectedOpt.option_text || selectedOpt.text || '')
                              : (language === 'ID' ? '— Pilih jawaban —' : '— Select an answer —')}
                          </Text>
                          <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                        </TouchableOpacity>

                        {/* Modal Dropdown Picker */}
                        <Modal
                          visible={showDropdownModal === currentQ.id}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setShowDropdownModal(null)}
                        >
                          <TouchableOpacity
                            style={styles.dropdownModalBackdrop}
                            activeOpacity={1}
                            onPress={() => setShowDropdownModal(null)}
                          >
                            <View
                              style={[
                                styles.dropdownModalContent,
                                { backgroundColor: isDark ? '#0F172A' : '#1E293B', borderColor: isDark ? '#334155' : '#475569' },
                              ]}
                            >
                              <View style={styles.dropdownModalHeader}>
                                <Text style={[styles.dropdownModalTitle, { color: '#FFFFFF', fontSize: 16 * fontSizeScale }]}>
                                  {language === 'ID' ? 'Pilih Jawaban' : 'Select Answer'}
                                </Text>
                                <TouchableOpacity onPress={() => setShowDropdownModal(null)} style={{ padding: 4 }}>
                                  <Ionicons name="close" size={22} color="#94A3B8" />
                                </TouchableOpacity>
                              </View>

                              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                                {qOptions.map((opt: any, i: number) => {
                                  const isSel = selectedOpt?.id === opt.id;

                                  return (
                                    <TouchableOpacity
                                      key={opt.id || i}
                                      style={[
                                        styles.dropdownOptionItem,
                                        isSel && { backgroundColor: 'rgba(59, 130, 246, 0.25)' },
                                      ]}
                                      onPress={() => {
                                        onSelectOption(currentQ.id, opt.id, false);
                                        setShowDropdownModal(null);
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={[styles.dropdownOptionText, { color: isSel ? '#60A5FA' : '#FFFFFF', fontSize: 15 * fontSizeScale }]}>
                                        {stripHtmlTags(opt.option_text || opt.text || '')}
                                      </Text>
                                      {isSel && <Ionicons name="checkmark" size={18} color="#60A5FA" />}
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          </TouchableOpacity>
                        </Modal>
                      </View>
                    );
                  })()}

                  {/* Short Answer */}
                  {isShortAnswerType && (
                    <View style={styles.textInputBox}>
                      <TextInput
                        style={[styles.shortAnswerInput, { height: 110, textAlignVertical: 'top', color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 16 * fontSizeScale }]}
                        placeholder="Write your answer here..."
                        placeholderTextColor={colors.textMuted}
                        value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                        onChangeText={(text) => onTextChange(currentQ.id, text)}
                        multiline
                      />
                    </View>
                  )}

                  {/* Essay Input */}
                  {isEssayType && (
                    <View style={styles.textInputBox}>
                      <TextInput
                        style={[styles.shortAnswerInput, { height: 160, textAlignVertical: 'top', color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 16 * fontSizeScale }]}
                        placeholder="Write your answer here..."
                        placeholderTextColor={colors.textMuted}
                        value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                        onChangeText={(text) => onTextChange(currentQ.id, text)}
                        multiline
                      />
                    </View>
                  )}

                  {/* Date Input */}
                  {isDateType && (
                    <View style={styles.textInputBox}>
                      <Text style={[styles.inputHelperLabel, { color: colors.textSub }]}>Format: YYYY-MM-DD (contoh: 2026-08-25)</Text>
                      <View style={styles.pickerFieldRow}>
                        <TextInput
                          style={[styles.pickerShortInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 16 * fontSizeScale }]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChangeText={(text) => onTextChange(currentQ.id, text)}
                        />
                        <TouchableOpacity
                          style={[styles.pickerTriggerBtnStyle, { backgroundColor: themeColor }]}
                          onPress={() => openPicker(currentQ.id, 'date')}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Time Input */}
                  {isTimeType && (
                    <View style={styles.textInputBox}>
                      <Text style={[styles.inputHelperLabel, { color: colors.textSub }]}>Format: HH:MM (contoh: 14:30)</Text>
                      <View style={styles.pickerFieldRow}>
                        <TextInput
                          style={[styles.pickerShortInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 16 * fontSizeScale }]}
                          placeholder="HH:MM"
                          placeholderTextColor={colors.textMuted}
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChangeText={(text) => onTextChange(currentQ.id, text)}
                        />
                        <TouchableOpacity
                          style={[styles.pickerTriggerBtnStyle, { backgroundColor: themeColor }]}
                          onPress={() => openPicker(currentQ.id, 'time')}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="time-outline" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Datetime Input — tgl dan waktu */}
                  {isDatetimeType && (
                    <View style={styles.textInputBox}>
                      <Text style={[styles.inputHelperLabel, { color: colors.textSub }]}>Format: YYYY-MM-DDTHH:MM (contoh: 2026-08-25T14:30)</Text>
                      <View style={styles.pickerFieldRow}>
                        <TextInput
                          style={[styles.pickerShortInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 16 * fontSizeScale }]}
                          placeholder="YYYY-MM-DDTHH:MM"
                          placeholderTextColor={colors.textMuted}
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChangeText={(text) => onTextChange(currentQ.id, text)}
                        />
                        <TouchableOpacity
                          style={[styles.pickerTriggerBtnStyle, { backgroundColor: themeColor }]}
                          onPress={() => setShowPicker({ qId: currentQ.id, mode: 'datetime' })}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {showPicker && (
                    <CustomDateTimePickerModal
                      visible={!!showPicker}
                      mode={showPicker.mode}
                      initialValue={typeof answers[showPicker.qId] === 'string' ? answers[showPicker.qId] : ''}
                      themeColor={themeColor}
                      onConfirm={(formattedVal) => {
                        onTextChange(showPicker.qId, formattedVal);
                        setShowPicker(null);
                      }}
                      onCancel={() => setShowPicker(null)}
                    />
                  )}

                  {/* Password Input — blocked until correct */}
                  {isPasswordType && (
                    <View style={styles.textInputBox}>
                      <View
                        style={[
                          styles.passwordContainer,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: pwWrong[currentQ.id] ? '#EF4444' : colors.inputBorder,
                          },
                          pwWrong[currentQ.id] && { borderWidth: 2 },
                        ]}
                      >
                        <TextInput
                          style={[
                            styles.passwordInput,
                            { color: colors.text, fontSize: 16 * fontSizeScale },
                          ]}
                          placeholder="Enter password"
                          placeholderTextColor={colors.textMuted}
                          secureTextEntry={!showPassword}
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChangeText={(text) => {
                            if (pwWrong[currentQ.id]) setPwWrong((p) => { const n = { ...p }; delete n[currentQ.id]; return n; });
                            onTextChange(currentQ.id, text);
                          }}
                        />
                        <TouchableOpacity
                          style={styles.eyeBtn}
                          onPress={() => setShowPassword(!showPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color={colors.textSub}
                          />
                        </TouchableOpacity>
                      </View>
                      {pwWrong[currentQ.id] && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <Ionicons name="warning-outline" size={14} color="#EF4444" />
                          <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
                            {language === 'ID' ? 'Password salah — tidak bisa lanjut' : 'Wrong password — cannot proceed'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* File Upload Input */}
                  {isFileUploadType && (
                    <View style={styles.fileUploadBox}>
                      <TouchableOpacity
                        style={[styles.fileUploadBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                        onPress={() => onPickFile(currentQ.id)}
                        disabled={fileUploading[currentQ.id]}
                      >
                        {fileUploading[currentQ.id] ? (
                          <ActivityIndicator color={themeColor} />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload-outline" size={24} color={colors.text} />
                            <Text style={[styles.fileUploadBtnText, { color: colors.text }]}>
                              {answers[currentQ.id] ? 'File Attached' : 'Upload File'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      {showPicker && (
        <CustomDateTimePickerModal
          visible={!!showPicker}
          mode={showPicker.mode}
          initialValue={typeof answers[showPicker.qId] === 'string' ? answers[showPicker.qId] : ''}
          themeColor={themeColor}
          onConfirm={(formattedVal) => {
            onTextChange(showPicker.qId, formattedVal);
            setShowPicker(null);
          }}
          onCancel={() => setShowPicker(null)}
        />
      )}

      {/* BOTTOM ACTION BAR (Matching Web Screenshot 1 with Previous Text & Bright Green Next Button) */}
      <View style={[styles.bottomActionBar, { backgroundColor: isDark ? '#0F172A' : colors.cardBg, borderTopColor: colors.cardBorder, paddingBottom: insets.bottom > 0 ? insets.bottom + 14 : 14 }]}>
        <View style={styles.bottomButtonsRow}>
          {currentIdx > 0 && (
            <TouchableOpacity
              style={[styles.prevBtnWithText, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : colors.inputBg, borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : colors.inputBorder }]}
              onPress={handlePrev}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={18} color={colors.textSub} />
              <Text style={[styles.prevBtnText, { color: colors.textSub, fontSize: 15 * fontSizeScale }]}>
                {language === 'ID' ? 'Sebelumnya' : 'Previous'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: themeColor }]}
            onPress={handleNext}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextBtnText, { fontSize: 16 * fontSizeScale }]}>
              {currentIdx === totalQ - 1
                ? (language === 'ID' ? 'Kirim Jawaban' : 'Submit')
                : (language === 'ID' ? 'Selanjutnya >' : 'Next >')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* QUESTION MAP MODAL */}
      <Modal visible={showMapModal} transparent animationType="fade" onRequestClose={() => setShowMapModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowMapModal(false)}>
          <View style={[styles.mapModalBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.mapModalHeader}>
              <Text style={[styles.mapModalTitle, { color: colors.text }]}>
                {language === 'ID' ? 'Peta Soal' : 'Question Map'}
              </Text>
              <TouchableOpacity onPress={() => setShowMapModal(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.mapGridContainer}>
              {questions.map((q, idx) => {
                const answered = isAnswered(q, answers[q.id]);
                const isCurrent = idx === currentIdx;
                const isMarked = reviewed[q.id];

                let bg = isDark ? '#334155' : '#F1F5F9';
                let textCol = colors.text;

                if (answered) {
                  bg = '#22C55E';
                  textCol = '#FFFFFF';
                } else if (isMarked) {
                  bg = '#F59E0B';
                  textCol = '#FFFFFF';
                } else if (isCurrent) {
                  bg = themeColor;
                  textCol = '#FFFFFF';
                }

                return (
                  <TouchableOpacity
                    key={q.id || idx}
                    style={[styles.mapGridItem, { backgroundColor: bg }, isCurrent && { borderWidth: 2.5, borderColor: '#FFFFFF' }]}
                    onPress={async () => {
                      if (idx > currentIdx) {
                        // cegah skip password: validasi semua password dari current sampai idx-1
                        const range = questions.slice(currentIdx, idx);
                        const hasBlockingPw = range.some((qq: any) => String(qq.type || qq.question_type || '').toLowerCase() === 'password' && qq.is_required !== false);
                        if (hasBlockingPw) {
                          const wrong = await checkPasswordForQuestions(range);
                          if (wrong.length) {
                            const errs: Record<number, boolean> = {};
                            wrong.forEach((id) => (errs[id] = true));
                            setPwWrong((p) => ({ ...p, ...errs }));
                            showAlert({
                              type: 'warning',
                              title: language === 'ID' ? 'Password wajib' : 'Password required',
                              message: language === 'ID' ? 'Selesaikan password yang benar sebelum loncat soal.' : 'Complete correct password before jumping.',
                            });
                            return;
                          }
                        }
                      }
                      setShowMapModal(false);
                      animateToQuestion(idx, idx > currentIdx ? 1 : -1);
                    }}
                  >
                    <Text style={[styles.mapGridText, { color: textCol }]}>{idx + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.mapLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.legendText, { color: colors.textSub }]}>{language === 'ID' ? 'Sudah Diisi' : 'Answered'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.legendText, { color: colors.textSub }]}>{language === 'ID' ? 'Ditandai' : 'Marked'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
                <Text style={[styles.legendText, { color: colors.textSub }]}>{language === 'ID' ? 'Belum Diisi' : 'Unanswered'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* EXAM INFO MODAL — paritas web ExamInfoDrawer */}
      <Modal visible={showInfoModal} transparent animationType="fade" onRequestClose={() => setShowInfoModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowInfoModal(false)}>
          <View style={[styles.infoModalBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.infoModalHeaderRow}>
              <Text style={[styles.infoModalHeaderTitle, { color: colors.text }]}>
                {language === 'ID' ? 'Info Ujian' : 'Exam Information'}
              </Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)} style={styles.infoModalXBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.infoModalTitle, { color: colors.text }]}>
                {stripHtmlTags(publicForm?.title) || 'Quizary'}
              </Text>
              {publicForm?.description ? (
                <Text style={[styles.infoModalDesc, { color: colors.textSub }]}>
                  {stripHtmlTags(publicForm.description)}
                </Text>
              ) : null}

              <Text style={[styles.infoSectionHeader, { color: colors.textSub }]}>
                {language === 'ID' ? 'Info Responden' : 'Respondent Info'}
              </Text>
              {infoRow(language === 'ID' ? 'Nama' : 'Name', respondentName)}
              {infoRow('Email', respondentEmail)}

              <Text style={[styles.infoSectionHeader, { color: colors.textSub }]}>
                {language === 'ID' ? 'Detail' : 'Details'}
              </Text>
              {infoRow(language === 'ID' ? 'Jumlah soal' : 'Number of questions', String(publicForm?.question_count ?? totalQ))}
              {infoRow(language === 'ID' ? 'Waktu' : 'Time', infoTimeStr)}
              {infoRow(language === 'ID' ? 'Pengiriman' : 'Submission', infoSubmissionStr)}
              {formattedTimerStr ? infoRow(language === 'ID' ? 'Sisa waktu' : 'Time left', formattedTimerStr) : null}

              {publicForm?.is_restricted ? (
                <View style={[styles.infoRestrictedBox, { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#F1F5F9' }]}>
                  <Text style={[styles.infoRestrictedText, { color: colors.textSub }]}>
                    {language === 'ID'
                      ? 'Tetap di tab ini selama ujian. Timer berjalan otomatis dan jawaban terkirim saat waktu habis.'
                      : 'Stay on this tab during the exam. Timer runs automatically and answers are submitted when time runs out.'}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={[styles.infoCloseBtn, { backgroundColor: themeColor }]} onPress={() => setShowInfoModal(false)}>
              <Text style={styles.infoCloseBtnText}>{language === 'ID' ? 'Mengerti' : 'Got it'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },

  /* HEADER BAR */
  headerBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  headerRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  infoIconBtn: { padding: 4 },
  headerQuizTitle: { color: '#FFFFFF', fontWeight: '800', flex: 1 },

  headerRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  timerBadgeText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  closeHeaderBtn: { padding: 4 },

  headerRowBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },

  mapSelectorBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  mapSelectorText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },

  /* QUESTION CONTAINER */
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30 },
  questionCardWrapper: { width: '100%', alignItems: 'center' },
  questionInnerContainer: { width: '100%', maxWidth: 600 },

  qMetaHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  optionalBadge: { backgroundColor: 'rgba(148, 163, 184, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  optionalText: { color: '#94A3B8', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.8 },

  reviewFlagBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
  reviewFlagBtnActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  reviewFlagText: { fontSize: 12, fontWeight: '700' },

  qTitleCenterWrapper: { width: '100%', alignItems: 'center', marginVertical: 12, paddingHorizontal: 10 },
  qTitleText: { fontWeight: '800', textAlign: 'center', lineHeight: 32 },

  qImageContainer: {
    width: '100%',
    maxHeight: 250,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  qImageStyle: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  zoomBadgeOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  optionImgStyle: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionImgLarge: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  zoomCenterWrapper: { width: '100%', alignItems: 'center', marginBottom: 12 },
  zoomPillBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(30, 41, 59, 0.7)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
  zoomPillText: { color: '#94A3B8', fontWeight: '600' },

  helperText: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  inputHelperLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: 'center' },

  pickerFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  pickerTriggerBtnStyle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* VIBRANT KAHOOT-STYLE OPTION TILES */
  optionsListContainer: { width: '100%' },
  optionTile: {
    width: '100%',
    minHeight: 72,
    borderRadius: 20,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  optionTileSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  letterCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  checkboxBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTileText: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 22,
  },
  selectedBadgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* INPUT FIELDS */
  textInputBox: { width: '100%', marginTop: 10 },
  shortAnswerInput: { width: '100%', minHeight: 56, borderRadius: 18, backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 18, paddingVertical: 14 },
  // Input sejajar tombol picker (54): tinggi fixed, bukan minHeight + paddingVertical
  // seperti shortAnswerInput — kalau tidak, input lebih tinggi dari tombol.
  pickerShortInput: { flex: 1, height: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 0, textAlignVertical: 'center' },
  passwordContainer: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  eyeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileUploadBox: { width: '100%', marginTop: 10 },
  fileUploadBtn: { width: '100%', height: 60, borderRadius: 18, backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  fileUploadBtnText: { color: '#FFF', fontWeight: 'bold' },

  /* DROPDOWN SELECT STYLES */
  dropdownWrapper: { width: '100%', marginTop: 10 },
  dropdownTriggerBtn: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerText: { fontWeight: '600', flex: 1, paddingRight: 10 },
  dropdownModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  dropdownModalTitle: { fontWeight: 'bold' },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginVertical: 3,
  },
  dropdownOptionText: { fontWeight: '600', flex: 1, paddingRight: 10 },

  /* BOTTOM ACTION BAR */
  bottomActionBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, backgroundColor: '#0F172A', borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' },
  bottomButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  prevBtnWithText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(30, 41, 59, 0.6)' },
  prevBtnText: { color: '#94A3B8', fontWeight: '700' },
  nextBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  nextBtnText: { color: '#FFFFFF', fontWeight: 'bold' },

  /* MODALS */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  mapModalBox: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 20, maxHeight: '80%' },
  mapModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mapModalTitle: { fontSize: 18, fontWeight: 'bold' },
  mapGridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 10 },
  mapGridItem: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mapGridText: { fontSize: 14, fontWeight: 'bold' },
  mapLegendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.2)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '600' },

  infoModalBox: { width: '100%', maxWidth: 360, maxHeight: '85%', borderRadius: 24, padding: 24, alignItems: 'center' },
  infoModalHeaderRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  infoModalHeaderTitle: { fontSize: 17, fontWeight: 'bold' },
  infoModalXBtn: { padding: 4 },
  infoModalScroll: { width: '100%', flexGrow: 0 },
  infoModalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  infoModalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 4, lineHeight: 20 },
  infoSectionHeader: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 2 },
  infoRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.25)' },
  infoRowLabel: { fontSize: 12, flexShrink: 0 },
  infoRowValue: { fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1 },
  infoRestrictedBox: { width: '100%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  infoRestrictedText: { fontSize: 12, lineHeight: 18 },
  infoCloseBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  infoCloseBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
});
