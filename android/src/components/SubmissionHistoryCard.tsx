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

  const isSubmitted = item.status === 'submitted';
  const isAutoSubmitted = item.status === 'auto_submitted';

  const getStatusLabel = () => {
    if (isSubmitted) {
      return language === 'ID' ? 'Selesai' : 'Submitted';
    }
    if (isAutoSubmitted) {
      return language === 'ID' ? 'Otomatis Terkirim' : 'Auto Submitted';
    }
    return language === 'ID' ? 'Dalam Proses' : 'In Progress';
  };

  const statusLabel = getStatusLabel();

  // Status Badge Colors (Exact match with web screenshot)
  let statusBg = isDark ? '#1E293B' : '#F1F5F9';
  let statusColor = colors.textMuted;

  if (isSubmitted) {
    statusBg = isDark ? '#064E3B' : '#DCFCE7';
    statusColor = isDark ? '#34D399' : '#059669';
  } else if (isAutoSubmitted) {
    statusBg = isDark ? '#3D2B00' : '#FEF3C7';
    statusColor = isDark ? '#FBBF24' : '#D97706';
  }

  // Format date string
  const dateStr = item.submitted_at || item.created_at || '';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top Row: Title + Link Icon and Status Badge Pill */}
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: colors.text, fontSize: 16 * fontSizeScale }]}
            numberOfLines={1}
          >
            {item.form_title || (language === 'ID' ? 'Form Tanpa Judul' : 'Untitled Form')}
          </Text>
          <Ionicons name="open-outline" size={14 * fontSizeScale} color={colors.textMuted} style={styles.linkIcon} />
        </View>

        <View style={[styles.badgePill, { backgroundColor: statusBg }]}>
          <Text style={[styles.badgeText, { color: statusColor, fontSize: 11 * fontSizeScale }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Bottom Row: Timestamp */}
      <View style={styles.bottomRow}>
        <Text style={[styles.dateText, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
          {language === 'ID'
            ? `Dikirim: ${dateStr || '-'}`
            : `Submitted: ${dateStr || '-'}`}
        </Text>

        {item.reveal_score && item.score !== null && item.score !== undefined && (
          <View style={[styles.scoreBadge, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
            <Ionicons name="trophy" size={12 * fontSizeScale} color="#10B981" />
            <Text style={[styles.scoreText, { fontSize: 11 * fontSizeScale }]}>
              {item.score}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  title: {
    fontWeight: '700',
  },
  linkIcon: {
    marginLeft: 6,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontWeight: '400',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  scoreText: {
    color: '#10B981',
    fontWeight: '700',
  },
});
