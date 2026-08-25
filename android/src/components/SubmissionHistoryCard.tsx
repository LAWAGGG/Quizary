import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface SubmissionHistoryCardProps {
  item: any;
  onPress: () => void;
}

export function SubmissionHistoryCard({ item, onPress }: SubmissionHistoryCardProps) {
  const { colors, isDark } = useAppTheme();
  const isQuiz = item.type === 'quiz';
  const statusLabel = item.status === 'submitted' ? 'Selesai' : item.status === 'auto_submitted' ? 'Waktu Habis' : 'Dalam Proses';
  const statusBg = item.status === 'submitted' ? (isDark ? '#064E3B' : '#ECFDF5') : item.status === 'auto_submitted' ? (isDark ? '#1E3A8A' : '#EFF6FF') : (isDark ? '#78350F' : '#FEF3C7');
  const statusColor = item.status === 'submitted' ? '#10B981' : item.status === 'auto_submitted' ? '#3B82F6' : '#F59E0B';

  return (
    <TouchableOpacity
      style={[styles.historyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.historyCardTop}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
            {item.form_title || 'Untitled Form'}
          </Text>
          <Text style={[styles.historyDate, { color: colors.textMuted }]}>
            {item.submitted_at ? `Dikirim pada ${item.submitted_at}` : 'Belum selesai'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.historyBadgesRow}>
        <View style={[styles.typeChip, { backgroundColor: isQuiz ? (isDark ? '#1E1B4B' : '#EEF2FF') : (isDark ? '#311B92' : '#F3E8FF') }]}>
          <Text style={[styles.typeChipText, { color: isQuiz ? '#6366F1' : '#9333EA' }]}>
            {isQuiz ? 'Quiz' : 'Form'}
          </Text>
        </View>

        <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {isQuiz && item.score !== null && item.score !== undefined && (
          <View style={styles.scoreChip}>
            <Ionicons name="trophy-outline" size={12} color="#10B981" />
            <Text style={styles.scoreChipText}>Nilai: {item.score}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  historyCard: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 10, gap: 10 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { fontSize: 15, fontWeight: 'bold' },
  historyDate: { fontSize: 12, marginTop: 2 },
  historyBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeChipText: { fontSize: 11, fontWeight: 'bold' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontWeight: 'bold' },
  scoreChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreChipText: { color: '#10B981', fontSize: 11, fontWeight: 'bold' },
});
