import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../context/ThemeContext';
import { useAppAlert } from '../../context/AlertContext';
import { RichTextRenderer, stripHtmlTags } from '../RichTextRenderer';
import { getThemeGradientColors } from './QuizBackground';
import { extractImgUrl } from './QuizQuestionCard';

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
}: QuizStyleAnsweringStepProps) {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const { showAlert } = useAppAlert();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  const [showMapModal, setShowMapModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [showPicker, setShowPicker] = useState<{ qId: number; mode: 'date' | 'time' } | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  const openPicker = (qId: number, mode: 'date' | 'time') => {
    const currentVal = answers[qId];
    let d = new Date();
    if (typeof currentVal === 'string' && currentVal.trim().length > 0) {
      if (mode === 'date') {
        const parts = currentVal.trim().split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
            d = new Date(y, m, day);
          }
        }
      } else if (mode === 'time') {
        const parts = currentVal.trim().split(':');
        if (parts.length >= 2) {
          const h = parseInt(parts[0], 10);
          const min = parseInt(parts[1], 10);
          if (!isNaN(h) && !isNaN(min)) {
            d = new Date();
            d.setHours(h, min, 0, 0);
          }
        }
      }
    }
    setPickerDate(d);
    setShowPicker({ qId, mode });
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const activePicker = showPicker;

    if (event.type === 'dismissed') {
      setShowPicker(null);
      return;
    }

    if (event.type === 'set' || (Platform.OS === 'ios' && selectedDate)) {
      setShowPicker(null);

      let dateToSave = selectedDate;
      if (!dateToSave && (event as any)?.nativeEvent?.timestamp) {
        const ts = Number((event as any).nativeEvent.timestamp);
        if (!isNaN(ts)) {
          dateToSave = new Date(ts);
        }
      }
      if (!dateToSave || isNaN(dateToSave.getTime())) {
        dateToSave = pickerDate;
      }

      setPickerDate(dateToSave);

      if (activePicker) {
        if (activePicker.mode === 'date') {
          const yyyy = dateToSave.getFullYear();
          const mm = String(dateToSave.getMonth() + 1).padStart(2, '0');
          const dd = String(dateToSave.getDate()).padStart(2, '0');
          onTextChange(activePicker.qId, `${yyyy}-${mm}-${dd}`);
        } else if (activePicker.mode === 'time') {
          const hh = String(dateToSave.getHours()).padStart(2, '0');
          const min = String(dateToSave.getMinutes()).padStart(2, '0');
          onTextChange(activePicker.qId, `${hh}:${min}`);
        }
      }
    }
  };

  const themeColor =
    publicForm?.theme_color ||
    publicForm?.color ||
    publicForm?.themeColor ||
    publicForm?.settings?.theme_color ||
    colors.primary;

  const gradientColors = getThemeGradientColors(themeColor);

  // Animation values for 1-by-1 question sliding
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const totalQ = questions.length;
  const currentQ = questions[currentIdx] || questions[0];

  const animateToQuestion = (newIdx: number, dir: number) => {
    slideAnim.setValue(dir * 50);
    fadeAnim.setValue(0.3);

    setCurrentIdx(newIdx);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isAnswered = (q: any, val: any) => {
    if (q?.type === 'file_upload' || q?.question_type === 'file_upload') return !!val;
    if (Array.isArray(val)) return val.length > 0;
    return !!val && String(val).trim().length > 0;
  };

  const toggleReview = (qId: number) => {
    setReviewed((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleNext = () => {
    if (!currentQ) return;

    // Validation check for required question
    const answerVal = answers[currentQ.id];
    const isRequired = currentQ.is_required !== false;
    if (isRequired && !isAnswered(currentQ, answerVal)) {
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Soal Wajib Belum Diisi' : 'Required Question Missing',
        message: language === 'ID'
          ? 'Mohon isi jawaban untuk soal ini sebelum melanjutkannya.'
          : 'Please select or enter an answer for this question before proceeding.',
      });
      return;
    }

    if (currentIdx < totalQ - 1) {
      animateToQuestion(currentIdx + 1, 1);
    } else {
      onSubmit();
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

  const isOptionType =
    rawType === 'multiple_choice' ||
    rawType === 'checkbox' ||
    rawType === 'dropdown' ||
    rawType === 'select' ||
    rawType === 'choice' ||
    qOptions.length > 0;

  const isDateType = rawType === 'date';
  const isTimeType = rawType === 'time';
  const isPasswordType = rawType === 'password';
  const isEssayType = rawType === 'essay' || rawType === 'long_text';
  const isFileUploadType = rawType === 'file_upload' || rawType === 'file';
  const isTextType = !isOptionType && !isDateType && !isTimeType && !isPasswordType && !isFileUploadType;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* TOP HEADER BAR (Linear Gradient Theme Bar matching Web Screenshot 1) */}
      <LinearGradient colors={gradientColors} style={styles.headerBar}>
        {/* Row 1: Info (i), Quiz Title, and Timer Pill */}
        <View style={styles.headerRowTop}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.infoIconBtn}
              onPress={() => setShowInfoModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={[styles.headerQuizTitle, { fontSize: 15 * fontSizeScale }]} numberOfLines={1}>
              {stripHtmlTags(publicForm?.title) || 'Kuis'}
            </Text>
          </View>

          <View style={styles.headerRightGroup}>
            {formattedTimerStr ? (
              <View style={styles.timerBadge}>
                <Ionicons name="timer-outline" size={14} color="#FFF" />
                <Text style={styles.timerBadgeText}>{formattedTimerStr}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.closeHeaderBtn} onPress={onCloseQuiz} activeOpacity={0.7}>
              <Ionicons name="close-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Progress Slider Bar & Question Map Selector Pill */}
        <View style={styles.headerRowBottom}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <TouchableOpacity
            style={styles.mapSelectorBtn}
            onPress={() => setShowMapModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="grid-outline" size={14} color="#FFF" />
            <Text style={styles.mapSelectorText}>
              {currentIdx + 1}/{totalQ}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* MAIN QUESTION CONTAINER */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.View
              style={[
                styles.questionCardWrapper,
                { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
              ]}
            >
              {currentQ && (
                <View style={styles.questionInnerContainer}>
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
                          : { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                      ]}
                      onPress={() => toggleReview(currentQ.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={reviewed[currentQ.id] ? 'bookmark' : 'bookmark-outline'}
                        size={14}
                        color={reviewed[currentQ.id] ? '#FFF' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.reviewFlagText,
                          { color: reviewed[currentQ.id] ? '#FFF' : '#94A3B8' },
                        ]}
                      >
                        {reviewed[currentQ.id] ? 'Marked' : 'Mark for review'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Centered Large Question Title */}
                  <View style={styles.qTitleCenterWrapper}>
                    <Text style={[styles.qTitleText, { color: '#FFFFFF', fontSize: 22 * fontSizeScale }]}>
                      {stripHtmlTags(currentQ.question_text)}
                      {currentQ.is_required !== false ? (
                        <Text style={{ color: '#EF4444', fontWeight: 'bold' }}> *</Text>
                      ) : null}
                    </Text>
                  </View>

                  {/* Question Image (if present) */}
                  {(() => {
                    const qImgUrl = extractImgUrl(currentQ, currentQ?.question_text);
                    if (!qImgUrl) return null;
                    return (
                      <TouchableOpacity
                        style={styles.qImageContainer}
                        onPress={() => onOpenZoom(currentQ)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: qImgUrl }}
                          style={styles.qImageStyle}
                          resizeMode="contain"
                        />
                        <View style={styles.zoomBadgeOverlay}>
                          <Ionicons name="expand-outline" size={12} color="#FFF" />
                          <Text style={styles.zoomBadgeText}>Ketuk untuk Zoom</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })()}

                  {/* Zoom Button Pill */}
                  <View style={styles.zoomCenterWrapper}>
                    <TouchableOpacity
                      style={styles.zoomPillBtn}
                      onPress={() => onOpenZoom(currentQ)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="search-outline" size={14} color="#94A3B8" />
                      <Text style={[styles.zoomPillText, { fontSize: 13 * fontSizeScale }]}>
                        Zoom in on question
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Helper Text (Pick one answer / Pick all that apply) */}
                  {isOptionType && (
                    <Text style={styles.helperText}>
                      {rawType === 'checkbox' ? 'Pick all that apply' : 'Pick one answer'}
                    </Text>
                  )}

                  {/* VIBRANT OPTION TILES (Multiple Choice, Checkbox, Dropdown) */}
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

                        return (
                          <TouchableOpacity
                            key={opt.id || i}
                            style={[
                              styles.optionTile,
                              { backgroundColor: bgCol },
                              selected && styles.optionTileSelected,
                            ]}
                            onPress={() => onSelectOption(currentQ.id, opt.id, isCheckbox)}
                            activeOpacity={0.85}
                          >
                            <View style={[styles.letterCircle, selected && isCheckbox && { backgroundColor: '#FFFFFF' }]}>
                              {isCheckbox && selected ? (
                                <Ionicons name="checkmark" size={16} color={bgCol} />
                              ) : (
                                <Text style={styles.letterText}>{LETTERS[i % LETTERS.length]}</Text>
                              )}
                            </View>

                            {optImgUrl && (
                              <Image
                                source={{ uri: optImgUrl }}
                                style={styles.optionImgStyle}
                                resizeMode="contain"
                              />
                            )}

                            <Text style={[styles.optionTileText, { fontSize: 16 * fontSizeScale }]}>
                              {stripHtmlTags(opt.option_text || opt.text || '')}
                            </Text>

                            {selected && !isCheckbox && (
                              <View style={styles.selectedBadgeCircle}>
                                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Short Answer / General Text Input */}
                  {isTextType && (
                    <View style={styles.textInputBox}>
                      <TextInput
                        style={[styles.shortAnswerInput, { color: '#FFF', fontSize: 16 * fontSizeScale }]}
                        placeholder="Tap to answer"
                        placeholderTextColor="#64748B"
                        value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                        onChangeText={(text) => onTextChange(currentQ.id, text)}
                      />
                    </View>
                  )}

                  {/* Essay Input */}
                  {isEssayType && (
                    <View style={styles.textInputBox}>
                      <TextInput
                        style={[styles.shortAnswerInput, { height: 160, textAlignVertical: 'top', color: '#FFF', fontSize: 16 * fontSizeScale }]}
                        placeholder="Write your answer here..."
                        placeholderTextColor="#64748B"
                        value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                        onChangeText={(text) => onTextChange(currentQ.id, text)}
                        multiline
                      />
                    </View>
                  )}

                  {/* Date Input */}
                  {isDateType && (
                    <View style={styles.textInputBox}>
                      <Text style={styles.inputHelperLabel}>Format: YYYY-MM-DD (contoh: 2026-08-25)</Text>
                      <View style={styles.pickerFieldRow}>
                        <TextInput
                          style={[styles.shortAnswerInput, { flex: 1, color: '#FFF', fontSize: 16 * fontSizeScale }]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#64748B"
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChangeText={(text) => onTextChange(currentQ.id, text)}
                        />
                        <TouchableOpacity
                          style={styles.pickerTriggerBtnStyle}
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
                      <Text style={styles.inputHelperLabel}>Format: HH:MM (contoh: 14:30)</Text>
                      <View style={styles.pickerFieldRow}>
                        <TextInput
                          style={[styles.shortAnswerInput, { flex: 1, color: '#FFF', fontSize: 16 * fontSizeScale }]}
                          placeholder="HH:MM"
                          placeholderTextColor="#64748B"
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChangeText={(text) => onTextChange(currentQ.id, text)}
                        />
                        <TouchableOpacity
                          style={styles.pickerTriggerBtnStyle}
                          onPress={() => openPicker(currentQ.id, 'time')}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="time-outline" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {showPicker && (
                    <DateTimePicker
                      value={pickerDate}
                      mode={showPicker.mode}
                      display="spinner"
                      is24Hour={true}
                      onChange={handlePickerChange}
                      onDismiss={() => setShowPicker(null)}
                    />
                  )}

                  {/* Password Input */}
                  {isPasswordType && (
                    <View style={styles.textInputBox}>
                      <TextInput
                        style={[styles.shortAnswerInput, { color: '#FFF', fontSize: 16 * fontSizeScale }]}
                        placeholder="Enter password"
                        placeholderTextColor="#64748B"
                        secureTextEntry
                        value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                        onChangeText={(text) => onTextChange(currentQ.id, text)}
                      />
                    </View>
                  )}

                  {/* File Upload Input */}
                  {isFileUploadType && (
                    <View style={styles.fileUploadBox}>
                      <TouchableOpacity
                        style={styles.fileUploadBtn}
                        onPress={() => onPickFile(currentQ.id)}
                        disabled={fileUploading[currentQ.id]}
                      >
                        {fileUploading[currentQ.id] ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload-outline" size={24} color="#FFF" />
                            <Text style={styles.fileUploadBtnText}>
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

      {/* BOTTOM ACTION BAR (Matching Web Screenshot 1 with Previous Text & Bright Green Next Button) */}
      <View style={styles.bottomActionBar}>
        <View style={styles.bottomButtonsRow}>
          {currentIdx > 0 && (
            <TouchableOpacity
              style={styles.prevBtnWithText}
              onPress={handlePrev}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={18} color="#94A3B8" />
              <Text style={[styles.prevBtnText, { fontSize: 15 * fontSizeScale }]}>
                {language === 'ID' ? 'Previous' : 'Previous'}
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
                : (language === 'ID' ? 'Next >' : 'Next >')}
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

                if (isCurrent) {
                  bg = themeColor;
                  textCol = '#FFFFFF';
                } else if (isMarked) {
                  bg = '#F59E0B';
                  textCol = '#FFFFFF';
                } else if (answered) {
                  bg = '#22C55E';
                  textCol = '#FFFFFF';
                }

                return (
                  <TouchableOpacity
                    key={q.id || idx}
                    style={[styles.mapGridItem, { backgroundColor: bg }]}
                    onPress={() => {
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

      {/* EXAM INFO MODAL */}
      <Modal visible={showInfoModal} transparent animationType="fade" onRequestClose={() => setShowInfoModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowInfoModal(false)}>
          <View style={[styles.infoModalBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <Text style={[styles.infoModalTitle, { color: colors.text }]}>
              {stripHtmlTags(publicForm?.title) || 'Quizary'}
            </Text>
            {publicForm?.description ? (
              <Text style={[styles.infoModalDesc, { color: colors.textSub }]}>
                {stripHtmlTags(publicForm.description)}
              </Text>
            ) : null}

            <View style={styles.infoModalMeta}>
              <Text style={[styles.infoModalMetaText, { color: colors.text }]}>
                {language === 'ID' ? `Total Soal: ${totalQ}` : `Total Questions: ${totalQ}`}
              </Text>
              {formattedTimerStr ? (
                <Text style={[styles.infoModalMetaText, { color: colors.text }]}>
                  {language === 'ID' ? `Sisa Waktu: ${formattedTimerStr}` : `Time Left: ${formattedTimerStr}`}
                </Text>
              ) : null}
            </View>

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
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30 },
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
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
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
  fileUploadBox: { width: '100%', marginTop: 10 },
  fileUploadBtn: { width: '100%', height: 60, borderRadius: 18, backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  fileUploadBtnText: { color: '#FFF', fontWeight: 'bold' },

  /* BOTTOM ACTION BAR */
  bottomActionBar: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#0F172A', borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' },
  bottomButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  prevBtnWithText: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(30, 41, 59, 0.6)' },
  prevBtnText: { color: '#94A3B8', fontWeight: '700' },
  nextBtn: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
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

  infoModalBox: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, alignItems: 'center' },
  infoModalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  infoModalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  infoModalMeta: { width: '100%', backgroundColor: 'rgba(148, 163, 184, 0.1)', padding: 14, borderRadius: 16, gap: 6, marginBottom: 20 },
  infoModalMetaText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  infoCloseBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  infoCloseBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
});
