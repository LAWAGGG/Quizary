import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface SubmissionDetailModalProps {
  visible: boolean;
  selectedSubItem: any;
  subDetail: any;
  loadingDetail: boolean;
  user: any;
  onClose: () => void;
}

export function SubmissionDetailModal({
  visible,
  selectedSubItem,
  subDetail,
  loadingDetail,
  user,
  onClose,
}: SubmissionDetailModalProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Rincian Jawaban</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loadingDetail ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.textSub, marginTop: 12, fontWeight: '600' }}>Memuat rincian jawaban...</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={true}>
              {/* Result summary */}
              <View style={[styles.detailSummaryBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.inputBorder }]}>
                <Text style={[styles.detailFormTitle, { color: colors.text }]}>
                  {selectedSubItem?.form_title || subDetail?.form_title || 'Hasil Form'}
                </Text>
                <Text style={[styles.detailMetaText, { color: colors.textSub }]}>
                  Nama Responden: {subDetail?.respondent_name || user?.name || 'Responden'}
                </Text>
                <Text style={[styles.detailMetaText, { color: colors.textSub }]}>
                  Status: {selectedSubItem?.status === 'submitted' ? 'Selesai' : selectedSubItem?.status === 'auto_submitted' ? 'Waktu Habis' : 'Dalam Proses'}
                </Text>
                {((subDetail?.score !== null && subDetail?.score !== undefined) || (selectedSubItem?.score !== null && selectedSubItem?.score !== undefined)) && (
                  <View style={styles.detailScoreBox}>
                    <Text style={styles.detailScoreVal}>
                      Skor: {subDetail?.score ?? selectedSubItem?.score} {subDetail?.max_score ? `/ ${subDetail.max_score}` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Questions & Answers review */}
              <Text style={[styles.reviewHeading, { color: colors.text }]}>Daftar Soal & Jawaban Anda</Text>

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
                      <Text style={{ fontStyle: 'italic', color: colors.textMuted }}>
                        Belum ada rincian jawaban yang dapat ditampilkan.
                      </Text>
                    </View>
                  );
                }

                return listToRender.map((qOrAns: any, i: number) => {
                  const qId = qOrAns.id || qOrAns.question_id;
                  const ans = ansMap.get(qId) || (qOrAns.answer_text || qOrAns.selected_options ? qOrAns : null);

                  const rawQText = qOrAns.question_text || qOrAns.title || ans?.question_text || `Soal ${i + 1}`;
                  const cleanQText = rawQText.replace(/<[^>]*>/g, '').trim();

                  let userAnsText = '';
                  if (ans) {
                    if (ans.answer_text) {
                      userAnsText = ans.answer_text;
                    } else if (ans.selected_options && ans.selected_options.length > 0) {
                      userAnsText = ans.selected_options
                        .map((opt: any) => (typeof opt === 'string' ? opt : opt.option_text || String(opt)))
                        .join(', ');
                    } else if (ans.selected_option_ids && ans.selected_option_ids.length > 0) {
                      const opts = qOrAns.options?.filter((o: any) => ans.selected_option_ids.includes(o.id));
                      userAnsText = opts && opts.length > 0 ? opts.map((o: any) => o.option_text).join(', ') : `Opsi dipilih (${ans.selected_option_ids.length})`;
                    } else if (ans.answer_file) {
                      userAnsText = '[File Terlampir]';
                    }
                  }

                  const isCorrect = ans?.is_correct;
                  const points = ans?.points_earned;

                  return (
                    <View key={qId || i} style={[styles.reviewItem, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.inputBorder }]}>
                      <Text style={[styles.reviewQText, { color: colors.text }]}>
                        {i + 1}. {cleanQText}
                      </Text>

                      {userAnsText ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[styles.ansLabel, { color: colors.textSub }]}>Jawaban Anda:</Text>
                          <Text style={[styles.ansVal, { color: colors.primary }]}>{userAnsText}</Text>
                          {isCorrect !== null && isCorrect !== undefined && (
                            <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4, color: isCorrect ? '#10B981' : '#EF4444' }}>
                              {isCorrect ? `✓ Benar ${points != null ? `(+${points} poin)` : ''}` : '✗ Salah'}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.textMuted, marginTop: 6 }}>
                          Tidak dijawab / Kosong
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
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  detailSummaryBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 16, gap: 4 },
  detailFormTitle: { fontSize: 16, fontWeight: 'bold' },
  detailMetaText: { fontSize: 13 },
  detailScoreBox: { backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  detailScoreVal: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  reviewHeading: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  reviewItem: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 10 },
  reviewQText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  ansLabel: { fontSize: 12, marginTop: 2 },
  ansVal: { fontSize: 13, fontWeight: 'bold', marginTop: 2 },
});
