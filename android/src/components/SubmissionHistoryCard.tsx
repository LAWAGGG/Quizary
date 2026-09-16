import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { isSubmissionExpired } from '../utils/api';

interface SubmissionHistoryCardProps {
  item: any;
  onPress: () => void;
}

export function SubmissionHistoryCard({ item, onPress }: SubmissionHistoryCardProps) {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  if (!item || typeof item !== 'object') return null;

  const isExpired = isSubmissionExpired(item);
  const isSubmitted = item.status === 'submitted';
  const isAutoSubmitted = item.status === 'auto_submitted' || (item.status === 'in_progress' && isExpired);
  const isCheating = item.status === 'cheating';
  const isLocked = item.status === 'locked';

  const getStatusLabel = () => {
    if (isCheating) {
      return 'Cheating';
    }
    if (isLocked) {
      return language === 'ID' ? 'Terkunci' : 'Locked';
    }
    if (isSubmitted) {
      return language === 'ID' ? 'Selesai' : 'Submitted';
    }
    if (isAutoSubmitted) {
      return language === 'ID' ? 'Otomatis Terkirim' : 'Auto Submitted';
    }
    return language === 'ID' ? 'Dalam Proses' : 'In Progress';
  };

  const statusLabel = getStatusLabel();

  let statusBg = isDark ? '#1E293B' : '#F1F5F9';
  let statusColor = colors.textMuted;
  let accent = colors.cardBorder;

  if (isCheating || isLocked) {
    statusBg = isDark ? 'rgba(220, 38, 38, 0.14)' : '#FEF2F2';
    statusColor = isDark ? '#FCA5A5' : '#DC2626';
    accent = '#EF4444';
  } else if (isSubmitted) {
    statusBg = isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5';
    statusColor = isDark ? '#6EE7B7' : '#059669';
    accent = '#10B981';
  } else if (isAutoSubmitted) {
    statusBg = isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB';
    statusColor = isDark ? '#FCD34D' : '#D97706';
    accent = '#F59E0B';
  } else {
    accent = colors.primary;
  }

  const isInProgress = item.status === 'in_progress' && !isExpired;

  // Bulletproof sanitization for formTitle, dateStr, and scoreVal
  let formTitle = language === 'ID' ? 'Form Tanpa Judul' : 'Untitled Form';
  if (typeof item.form_title === 'string' && item.form_title.trim()) {
    formTitle = item.form_title;
  } else if (typeof item.title === 'string' && item.title.trim()) {
    formTitle = item.title;
  } else if (item.form && typeof item.form === 'object' && typeof item.form.title === 'string' && item.form.title.trim()) {
    formTitle = item.form.title;
  }

  let dateStr = '';
  const rawDate = isInProgress
    ? (item.started_at || item.created_at || item.updated_at)
    : (item.submitted_at || item.updated_at || item.created_at);

  if (typeof rawDate === 'string') {
    dateStr = rawDate;
  } else if (typeof rawDate === 'number') {
    dateStr = String(rawDate);
  }

  const getDateLabel = () => {
    if (!dateStr) return '-';
    if (isInProgress) {
      return language === 'ID' ? `Dimulai: ${dateStr}` : `Started: ${dateStr}`;
    }
    return language === 'ID' ? `Dikirim: ${dateStr}` : `Submitted: ${dateStr}`;
  };

  let scoreVal: string | number | null = null;
  if (item.reveal_score && item.score !== null && item.score !== undefined) {
    if (typeof item.score === 'number' || typeof item.score === 'string') {
      scoreVal = item.score;
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: colors.text, fontSize: 14.5 * fontSizeScale }]}
            numberOfLines={1}
          >
            {formTitle}
          </Text>
          <Ionicons name="open-outline" size={12 * fontSizeScale} color={colors.textMuted} style={styles.linkIcon} />
        </View>

        <View style={[styles.badgePill, { backgroundColor: statusBg, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.badgeText, { color: statusColor, fontSize: 10 * fontSizeScale }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Bottom Row: Timestamp */}
      <View style={styles.bottomRow}>
        <Text style={[styles.dateText, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
          {getDateLabel()}
        </Text>

        {scoreVal !== null && (
          <View style={[styles.scoreBadge, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
            <Ionicons name="trophy" size={12 * fontSizeScale} color="#10B981" />
            <Text style={[styles.scoreText, { fontSize: 11 * fontSizeScale }]}>
              {scoreVal}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.95,
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
