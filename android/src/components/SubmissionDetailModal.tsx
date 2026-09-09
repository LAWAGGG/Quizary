import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { stripHtmlTags } from './RichTextRenderer';

interface SubmissionDetailModalProps {
  visible: boolean;
  selectedSubItem: any;
  subDetail: any;
  loadingDetail: boolean;
  user: any;
  onClose: () => void;
  onContinue?: (item: any, detail: any) => void;
}

export function SubmissionDetailModal({
  visible,
  selectedSubItem,
  subDetail,
  loadingDetail,
  user,
  onClose,
  onContinue,
}: SubmissionDetailModalProps) {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text, fontSize: 18 * fontSizeScale }]}>
              {language === 'ID' ? 'Rincian Jawaban' : 'Answer Details'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24 * fontSizeScale} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loadingDetail ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.textSub, marginTop: 12, fontWeight: '600', fontSize: 14 * fontSizeScale }}>
                {language === 'ID' ? 'Memuat rincian jawaban...' : 'Loading answer details...'}
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={true}>
              {/* Result summary */}
              <View style={[styles.detailSummaryBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.inputBorder }]}>
                <Text style={[styles.detailFormTitle, { color: colors.text, fontSize: 16 * fontSizeScale }]}>
                  {stripHtmlTags(selectedSubItem?.form_title || subDetail?.form_title) || (language === 'ID' ? 'Hasil Form' : 'Form Result')}
                </Text>
                <Text style={[styles.detailMetaText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  {language === 'ID' ? 'Nama Responden: ' : 'Respondent Name: '}
                  {subDetail?.respondent_name || user?.name || (language === 'ID' ? 'Responden' : 'Respondent')}
                </Text>
                <Text style={[styles.detailMetaText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  Status: {
                    (selectedSubItem?.status === 'cheating' || subDetail?.status === 'cheating')
                      ? 'Cheating'
                      : (selectedSubItem?.status === 'locked' || subDetail?.status === 'locked')
                      ? (language === 'ID' ? 'Terkunci (Pelanggaran)' : 'Locked (Violation)')
                      : (selectedSubItem?.status === 'submitted' || subDetail?.status === 'submitted')
                      ? (language === 'ID' ? 'Selesai' : 'Completed')
                      : (selectedSubItem?.status === 'auto_submitted' || subDetail?.status === 'auto_submitted')
                      ? (language === 'ID' ? 'Waktu Habis' : 'Time Up')
                      : (language === 'ID' ? 'Dalam Proses' : 'In Progress')
                  }
                </Text>
                {((subDetail?.cheat_reason || selectedSubItem?.cheat_reason || subDetail?.status === 'cheating' || selectedSubItem?.status === 'cheating') && (
                  <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: '#EF4444', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 4 }}>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 * fontSizeScale }}>
                      ⚠️ Status: Cheating
                    </Text>
                    {(subDetail?.cheat_reason || selectedSubItem?.cheat_reason) ? (
                      <Text style={{ color: colors.text, fontSize: 11 * fontSizeScale, marginTop: 2 }}>
                        {language === 'ID' ? 'Catatan: ' : 'Note: '}{subDetail?.cheat_reason || selectedSubItem?.cheat_reason}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {((subDetail?.score !== null && subDetail?.score !== undefined) || (selectedSubItem?.score !== null && selectedSubItem?.score !== undefined)) && (
                  <View style={styles.detailScoreBox}>
                    <Text style={[styles.detailScoreVal, { fontSize: 14 * fontSizeScale }]}>
                      {language === 'ID' ? 'Skor: ' : 'Score: '}{subDetail?.score ?? selectedSubItem?.score} {subDetail?.max_score ? `/ ${subDetail.max_score}` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {(selectedSubItem?.status === 'in_progress' || subDetail?.status === 'in_progress') && (
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={() => onContinue && onContinue(selectedSubItem, subDetail)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 * fontSizeScale }}>
                    {language === 'ID' ? 'Lanjutkan Mengerjakan' : 'Continue'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Questions & Answers review */}
              <Text style={[styles.reviewHeading, { color: colors.text, fontSize: 14 * fontSizeScale }]}>
                {language === 'ID' ? 'Daftar Soal & Jawaban Anda' : 'Your Questions & Answers'}
              </Text>

              {(() => {
                const questionsList = subDetail?.questions || [];
                const answersList = subDetail?.answers || [];

                // Map answers by question_id for quick lookup
                const ansMap = new Map<number, any>();
                answersList.forEach((a: any) => {
                  if (a.question_id) ansMap.set(a.question_id, a);
                });

                const listToRender = questionsList.length > 0 ? questionsList : answersList;

                if (listToRender.length === 0) {
                  return (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ fontStyle: 'italic', color: colors.textMuted, fontSize: 13 * fontSizeScale }}>
                        {language === 'ID'
                          ? 'Belum ada rincian jawaban yang dapat ditampilkan.'
                          : 'No answer details available to display.'}
                      </Text>
                    </View>
                  );
                }

                return listToRender.map((qOrAns: any, i: number) => {
                  const qId = qOrAns.id || qOrAns.question_id;
                  const ans = ansMap.get(qId) || (qOrAns.answer_text || qOrAns.selected_options ? qOrAns : null);

                  const defaultQTitle = language === 'ID' ? `Soal ${i + 1}` : `Question ${i + 1}`;
                  const rawQText = qOrAns.question_text || qOrAns.title || ans?.question_text || defaultQTitle;
                  const cleanQText = stripHtmlTags(rawQText);

                  let userAnsText = '';
                  if (ans) {
                    if (ans.answer_text) {
                      userAnsText = stripHtmlTags(ans.answer_text);
                    } else if (ans.selected_options && ans.selected_options.length > 0) {
                      userAnsText = ans.selected_options
                        .map((opt: any) => (typeof opt === 'string' ? stripHtmlTags(opt) : stripHtmlTags(opt.option_text) || String(opt)))
                        .join(', ');
                    } else if (ans.selected_option_ids && ans.selected_option_ids.length > 0) {
                      const opts = qOrAns.options?.filter((o: any) => ans.selected_option_ids.includes(o.id));
                      userAnsText = opts && opts.length > 0
                        ? opts.map((o: any) => stripHtmlTags(o.option_text)).join(', ')
                        : (language === 'ID'
                            ? `Opsi dipilih (${ans.selected_option_ids.length})`
                            : `Selected options (${ans.selected_option_ids.length})`);
                    } else if (ans.answer_file) {
                      userAnsText = language === 'ID' ? '[File Terlampir]' : '[Attached File]';
                    }
                  }

                  const isCorrect = ans?.is_correct;
                  const points = ans?.points_earned;

                  return (
                    <View key={qId || i} style={[styles.reviewItem, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.inputBorder }]}>
                      <Text style={[styles.reviewQText, { color: colors.text, fontSize: 14 * fontSizeScale }]}>
                        {i + 1}. {cleanQText}
                      </Text>

                      {userAnsText ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[styles.ansLabel, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
                            {language === 'ID' ? 'Jawaban Anda:' : 'Your Answer:'}
                          </Text>
                          <Text style={[styles.ansVal, { color: colors.primary, fontSize: 13 * fontSizeScale }]}>{userAnsText}</Text>
                          {isCorrect !== null && isCorrect !== undefined && (
                            <Text style={{ fontSize: 12 * fontSizeScale, fontWeight: 'bold', marginTop: 4, color: isCorrect ? '#10B981' : '#EF4444' }}>
                              {isCorrect
                                ? (language === 'ID'
                                    ? `✓ Benar ${points != null ? `(+${points} poin)` : ''}`
                                    : `✓ Correct ${points != null ? `(+${points} pts)` : ''}`)
                                : (language === 'ID' ? '✗ Salah' : '✗ Incorrect')}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12 * fontSizeScale, fontStyle: 'italic', color: colors.textMuted, marginTop: 6 }}>
                          {language === 'ID' ? 'Tidak dijawab / Kosong' : 'Unanswered / Empty'}
                        </Text>
                      )}
                    </View>
                  );
                });
              })()}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '82%', width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontWeight: 'bold' },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  detailSummaryBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 16, gap: 4 },
  detailFormTitle: { fontWeight: 'bold' },
  detailMetaText: {},
  detailScoreBox: { backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  detailScoreVal: { color: '#FFF', fontWeight: 'bold' },

  reviewHeading: { fontWeight: 'bold', marginBottom: 10 },
  reviewItem: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 10 },
  reviewQText: { fontWeight: '600', lineHeight: 20 },
  ansLabel: { marginTop: 2 },
  ansVal: { fontWeight: 'bold', marginTop: 2 },
});
