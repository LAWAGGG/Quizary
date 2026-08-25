import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { RichTextRenderer } from '../RichTextRenderer';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface QuizQuestionCardProps {
  question: any;
  index: number;
  userAnswer: any;
  isFileUploading: boolean;
  onSelectOption: (qId: number, optId: number, isCheckbox: boolean) => void;
  onTextChange: (qId: number, text: string) => void;
  onPickFile: (qId: number) => void;
}

export function QuizQuestionCard({
  question: q,
  index: idx,
  userAnswer,
  isFileUploading,
  onSelectOption,
  onTextChange,
  onPickFile,
}: QuizQuestionCardProps) {
  const { colors, isDark } = useAppTheme();
  const isReq = q.is_required !== false;

  return (
    <View style={[styles.questionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      {/* Header & Question Text */}
      <View style={styles.qHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.qNum, { color: colors.primary }]}>Soal {idx + 1}</Text>
          <RichTextRenderer html={q.question_text || ''} style={{ fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 }} />
        </View>
        {isReq && (
          <View style={styles.reqTag}>
            <Text style={styles.reqTagText}>Wajib</Text>
          </View>
        )}
      </View>

      {/* Image if present */}
      {q.image && <Image source={{ uri: q.image.path || q.image }} style={styles.qImage} resizeMode="contain" />}

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
                  isSelected && { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: colors.primary },
                ]}
                onPress={() => onSelectOption(q.id, opt.id, q.type === 'checkbox')}
                activeOpacity={0.7}
              >
                <View style={[styles.letterBubble, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }, isSelected && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.letterText, { color: colors.text }, isSelected && { color: '#FFF' }]}>{letter}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <RichTextRenderer html={opt.option_text || ''} style={{ fontSize: 14, color: isSelected ? colors.primary : colors.text }} />
                </View>

                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
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
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Format: YYYY-MM-DD (contoh: 2026-08-25)"
          placeholderTextColor={colors.textMuted}
          value={typeof userAnswer === 'string' ? userAnswer : ''}
          onChangeText={(txt) => onTextChange(q.id, txt)}
        />
      )}

      {/* Time Input */}
      {q.type === 'time' && (
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Format: HH:MM (contoh: 14:30)"
          placeholderTextColor={colors.textMuted}
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
    </View>
  );
}

const styles = StyleSheet.create({
  questionCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 16 },
  qHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  qNum: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  reqTag: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  reqTagText: { color: '#D97706', fontSize: 11, fontWeight: 'bold' },
  qImage: { width: '100%', height: 180, borderRadius: 10, marginVertical: 12 },

  optionsList: { gap: 10, marginTop: 14 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  letterBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 13, fontWeight: 'bold' },

  textInput: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 14, marginTop: 12 },
  textArea: { height: 110, textAlignVertical: 'top' },

  fileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 12 },
  fileBtnText: { fontWeight: 'bold', fontSize: 14 },
  fileAttachedText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
