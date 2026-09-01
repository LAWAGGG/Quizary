import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAppTheme } from '../../context/ThemeContext';
import { RichTextRenderer } from '../RichTextRenderer';
import { ImageZoomModal } from '../ImageZoomModal';
import { BASE_URL } from '../../services/api_service';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const extractImgUrl = (item: any, htmlText?: string): string | null => {
  if (!item && !htmlText) return null;

  const rawProp =
    item?.image?.path ||
    item?.image?.url ||
    (typeof item?.image === 'string' ? item.image : null) ||
    item?.image_path ||
    item?.image_url ||
    item?.imageUrl ||
    item?.media ||
    item?.question_image;

  let urlStr = typeof rawProp === 'string' ? rawProp : null;

  if (!urlStr && htmlText) {
    const match = htmlText.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) {
      urlStr = match[1];
    }
  }

  if (!urlStr) return null;

  if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:')) {
    return urlStr;
  }

  const rootHost = BASE_URL.replace(/\/api\/?$/, '');
  const cleanPath = urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
  return `${rootHost}${cleanPath}`;
};

interface QuizQuestionCardProps {
  question: any;
  index: number;
  userAnswer: any;
  isFileUploading: boolean;
  themeColor?: string;
  hasError?: boolean;
  onZoomQuestion?: (q: any) => void;
  onSelectOption: (qId: number, optId: number, isCheckbox: boolean) => void;
  onTextChange: (qId: number, text: string) => void;
  onPickFile: (qId: number) => void;
}

function QuizQuestionCardComponent({
  question: q,
  index: idx,
  userAnswer,
  isFileUploading,
  themeColor,
  hasError,
  onZoomQuestion,
  onSelectOption,
  onTextChange,
  onPickFile,
}: QuizQuestionCardProps) {
  const { colors, isDark, language } = useAppTheme();
  const activeColor = themeColor || colors.primary;
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const isReq = q.is_required !== false;

  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  const openPicker = (mode: 'date' | 'time') => {
    let d = new Date();
    if (typeof userAnswer === 'string' && userAnswer.trim().length > 0) {
      if (mode === 'date') {
        const parts = userAnswer.trim().split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
            d = new Date(y, m, day);
          }
        }
      } else if (mode === 'time') {
        const parts = userAnswer.trim().split(':');
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
    setShowPicker(mode);
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const activeMode = showPicker;

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

      if (activeMode) {
        if (activeMode === 'date') {
          const yyyy = dateToSave.getFullYear();
          const mm = String(dateToSave.getMonth() + 1).padStart(2, '0');
          const dd = String(dateToSave.getDate()).padStart(2, '0');
          onTextChange(q.id, `${yyyy}-${mm}-${dd}`);
        } else if (activeMode === 'time') {
          const hh = String(dateToSave.getHours()).padStart(2, '0');
          const min = String(dateToSave.getMinutes()).padStart(2, '0');
          onTextChange(q.id, `${hh}:${min}`);
        }
      }
    }
  };

  const imgUri = extractImgUrl(q, q.question_text);

  return (
    <View style={[
      styles.questionCard,
      { backgroundColor: colors.cardBg, borderColor: hasError ? '#EF4444' : colors.cardBorder },
      hasError && { borderWidth: 2 }
    ]}>
      {/* Header & Question Text */}
      <View style={styles.qHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.qNum, { color: activeColor }]}>Soal {idx + 1}</Text>
          <RichTextRenderer html={q.question_text || ''} style={{ fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 24 }} />
        </View>
        {isReq && (
          <Text style={styles.reqAsterisk}>*</Text>
        )}
      </View>

      {hasError && (
        <View style={styles.errorWarningBanner}>
          <Ionicons name="warning-outline" size={14} color="#EF4444" />
          <Text style={styles.errorWarningText}>
            {language === 'ID' ? 'Soal ini wajib diisi' : 'This question is required'}
          </Text>
        </View>
      )}

      {/* Zoom in on question pill button (Matching Web Screenshot) */}
      {onZoomQuestion && (
        <TouchableOpacity
          style={[styles.zoomQuestionPillBtn, { backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : '#F1F5F9', borderColor: colors.cardBorder }]}
          onPress={() => onZoomQuestion(q)}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={14} color={colors.textSub} />
          <Text style={[styles.zoomQuestionPillText, { color: colors.textSub }]}>
            Zoom in on question
          </Text>
        </TouchableOpacity>
      )}

      {/* Image if present with Tap-to-Zoom */}
      {imgUri && (
        <TouchableOpacity activeOpacity={0.85} onPress={() => setZoomUri(imgUri)} style={styles.imageContainer}>
          <Image source={{ uri: imgUri }} style={styles.qImage} resizeMode="contain" />
          <View style={styles.zoomBadge}>
            <Ionicons name="expand-outline" size={14} color="#FFF" />
            <Text style={styles.zoomBadgeText}>Ketuk untuk Zoom</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Multiple Choice / Checkbox Options */}
      {(q.type === 'multiple_choice' || q.type === 'checkbox' || q.type === 'dropdown') && (
        <View style={styles.optionsList}>
          {(q.options || []).map((opt: any, i: number) => {
            const selectedIds: number[] = Array.isArray(userAnswer) ? userAnswer : [];
            const isSelected = selectedIds.includes(opt.id);
            const letter = LETTERS[i % LETTERS.length];

            return (
              <TouchableOpacity
                key={opt.id || i}
                style={[
                  styles.optionCard,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                  isSelected && { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : '#EEF2FF', borderColor: activeColor },
                ]}
                onPress={() => onSelectOption(q.id, opt.id, q.type === 'checkbox')}
                activeOpacity={0.7}
              >
                <View style={[styles.letterBubble, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }, isSelected && { backgroundColor: activeColor }]}>
                  <Text style={[styles.letterText, { color: colors.text }, isSelected && { color: '#FFF' }]}>{letter}</Text>
                </View>

                <View style={{ flex: 1, flexShrink: 1, paddingRight: 4 }}>
                  <RichTextRenderer html={opt.option_text || ''} style={{ fontSize: 14, color: isSelected ? activeColor : colors.text }} />
                </View>

                {isSelected && <Ionicons name="checkmark-circle" size={20} color={activeColor} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Short Answer Input */}
      {q.type === 'short_answer' && (
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Ketikan jawaban singkat Anda..."
          placeholderTextColor={colors.textMuted}
          value={typeof userAnswer === 'string' ? userAnswer : ''}
          onChangeText={(txt) => onTextChange(q.id, txt)}
        />
      )}

      {/* Essay Input */}
      {q.type === 'essay' && (
        <TextInput
          style={[styles.textInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Tuliskan jawaban lengkap Anda di sini..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={5}
          value={typeof userAnswer === 'string' ? userAnswer : ''}
          onChangeText={(txt) => onTextChange(q.id, txt)}
        />
      )}

      {/* Date Input */}
      {q.type === 'date' && (
        <View style={styles.pickerFieldContainer}>
          <TextInput
            style={[styles.textInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
            placeholder="Format: YYYY-MM-DD (contoh: 2026-08-25)"
            placeholderTextColor={colors.textMuted}
            value={typeof userAnswer === 'string' ? userAnswer : ''}
            onChangeText={(txt) => onTextChange(q.id, txt)}
          />
          <TouchableOpacity
            style={[styles.pickerTriggerBtn, { backgroundColor: activeColor }]}
            onPress={() => openPicker('date')}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Time Input */}
      {q.type === 'time' && (
        <View style={styles.pickerFieldContainer}>
          <TextInput
            style={[styles.textInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
            placeholder="Format: HH:MM (contoh: 14:30)"
            placeholderTextColor={colors.textMuted}
            value={typeof userAnswer === 'string' ? userAnswer : ''}
            onChangeText={(txt) => onTextChange(q.id, txt)}
          />
          <TouchableOpacity
            style={[styles.pickerTriggerBtn, { backgroundColor: activeColor }]}
            onPress={() => openPicker('time')}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode={showPicker}
          display="spinner"
          is24Hour={true}
          onChange={handlePickerChange}
          onDismiss={() => setShowPicker(null)}
        />
      )}

      {/* Password Input */}
      {q.type === 'password' && (
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Enter password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={typeof userAnswer === 'string' ? userAnswer : ''}
          onChangeText={(txt) => onTextChange(q.id, txt)}
        />
      )}

      {/* File Upload Input */}
      {q.type === 'file_upload' && (
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[styles.fileBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            onPress={() => onPickFile(q.id)}
            disabled={isFileUploading}
          >
            {isFileUploading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                <Text style={[styles.fileBtnText, { color: colors.primary }]}>
                  {userAnswer ? 'Ganti File Jawaban' : 'Unggah File Jawaban'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {userAnswer ? (
            <Text style={[styles.fileAttachedText, { color: colors.badgePublishedText }]} numberOfLines={1}>
              ✓ File terlampir: {userAnswer}
            </Text>
          ) : null}
        </View>
      )}

      {/* Image Zoom Modal */}
      {!!zoomUri && (
        <ImageZoomModal
          visible={!!zoomUri}
          imageUri={zoomUri}
          onClose={() => setZoomUri(null)}
        />
      )}
    </View>
  );
}

const isAnswersEqual = (a: any, b: any) => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
  return false;
};

export const QuizQuestionCard = React.memo(
  QuizQuestionCardComponent,
  (prevProps, nextProps) => {
    return (
      isAnswersEqual(prevProps.userAnswer, nextProps.userAnswer) &&
      prevProps.hasError === nextProps.hasError &&
      prevProps.isFileUploading === nextProps.isFileUploading &&
      prevProps.question === nextProps.question &&
      prevProps.themeColor === nextProps.themeColor &&
      prevProps.index === nextProps.index
    );
  }
);

const styles = StyleSheet.create({
  questionCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 16 },
  qHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  qNum: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  reqAsterisk: { color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginLeft: 4 },
  reqTag: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  reqTagText: { color: '#D97706', fontSize: 11, fontWeight: 'bold' },

  errorWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: -2,
  },
  errorWarningText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },

  zoomQuestionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 10,
  },
  zoomQuestionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  imageContainer: { position: 'relative', marginVertical: 12, borderRadius: 10, overflow: 'hidden' },
  qImage: { width: '100%', height: 200, borderRadius: 10 },
  zoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  zoomBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },

  optionsList: { gap: 10, marginTop: 14 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  letterBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 13, fontWeight: 'bold' },

  textInput: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 14, marginTop: 12 },
  textArea: { height: 110, textAlignVertical: 'top' },

  pickerFieldContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  pickerTriggerBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  fileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 12 },
  fileBtnText: { fontWeight: 'bold', fontSize: 14 },
  fileAttachedText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
