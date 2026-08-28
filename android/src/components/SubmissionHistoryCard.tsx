import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface SubmissionHistoryCardProps {
  item: any;
  onPress: () => void;
}

export function SubmissionHistoryCard({ item, onPress }: SubmissionHistoryCardProps) {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const isQuiz = item.type === 'quiz';

  // Penyesuaian bahasa untuk label status
  const getStatusLabel = () => {
    if (item.status === 'submitted') {
      return language === 'ID' ? 'Selesai' : 'Completed';
    }
    if (item.status === 'auto_submitted') {
      return language === 'ID' ? 'Waktu Habis' : 'Time Up';
    }
    return language === 'ID' ? 'Dalam Proses' : 'In Progress';
  };

  const statusLabel = getStatusLabel();
  const statusBg = item.status === 'submitted' ? (isDark ? '#064E3B' : '#ECFDF5') : item.status === 'auto_submitted' ? (isDark ? '#2F2690' : '#F0EFFF') : (isDark ? '#78350F' : '#FEF3C7');
  const statusColor = item.status === 'submitted' ? '#10B981' : item.status === 'auto_submitted' ? '#6C5CE7' : '#F59E0B';

  return (
    <TouchableOpacity
      style={[styles.historyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.historyCardTop}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.historyTitle, { color: colors.text, fontSize: 15 * fontSizeScale }]} numberOfLines={1}>
            {item.form_title || (language === 'ID' ? 'Form Tanpa Judul' : 'Untitled Form')}
          </Text>
          <Text style={[styles.historyDate, { color: colors.textMuted, fontSize: 12 * fontSizeScale }]}>
            {item.submitted_at
              ? (language === 'ID' ? `Dikirim pada ${item.submitted_at}` : `Submitted on ${item.submitted_at}`)
              : (language === 'ID' ? 'Belum selesai' : 'Not completed')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18 * fontSizeScale} color={colors.textMuted} />
      </View>

      <View style={styles.historyBadgesRow}>
        <View style={[styles.typeChip, { backgroundColor: isQuiz ? (isDark ? '#2F2690' : '#F0EFFF') : (isDark ? '#311B92' : '#F3E8FF') }]}>
          <Text style={[styles.typeChipText, { color: isQuiz ? '#6C5CE7' : '#9333EA', fontSize: 11 * fontSizeScale }]}>
            {isQuiz ? 'Quiz' : 'Form'}
          </Text>
        </View>

        <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusChipText, { color: statusColor, fontSize: 11 * fontSizeScale }]}>{statusLabel}</Text>
        </View>

        {!isQuiz && item.reveal_score && item.score !== null && item.score !== undefined && (
          <View style={styles.scoreChip}>
            <Ionicons name="trophy-outline" size={12 * fontSizeScale} color="#10B981" />
            <Text style={[styles.scoreChipText, { fontSize: 11 * fontSizeScale }]}>
              {language === 'ID' ? `Nilai: ${item.score}` : `Score: ${item.score}`}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  historyCard: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 10, gap: 10 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { fontWeight: 'bold' },
  historyDate: { marginTop: 2 },
  historyBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeChipText: { fontWeight: 'bold' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontWeight: 'bold' },
  scoreChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreChipText: { color: '#10B981', fontWeight: 'bold' },
});
