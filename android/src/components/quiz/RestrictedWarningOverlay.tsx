import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  countdown: number; // 5..0
  themeColor?: string;
  onReenter: () => void;
  isPinned?: boolean;
  isExpoGo?: boolean;
}

export function RestrictedWarningOverlay({ visible, countdown, themeColor, onReenter, isPinned, isExpoGo }: Props) {
  if (!visible) return null;
  const activeColor = themeColor || '#6C5CE7';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0F172A', zIndex: 99999 }]} pointerEvents="auto">
      <View style={styles.center}>
        {/* Warning Icon Badge with Theme Tint */}
        <View style={[styles.iconCircle, { backgroundColor: `${activeColor}20`, borderColor: `${activeColor}50` }]}>
          <Ionicons name="warning-outline" size={32} color={activeColor} />
        </View>

        <Text style={styles.title}>Peringatan Pelanggaran</Text>

        {/* Countdown card - Theme Styled */}
        <View style={[styles.countdownCard, { borderColor: `${activeColor}45` }]}>
          <Text style={[styles.countdownLabel, { color: activeColor }]}>KEMBALI DALAM</Text>
          <Text style={[styles.countdownNumber, { color: activeColor }]}>{countdown}</Text>
          <Text style={styles.countdownHint}>detik atau ujian akan dikunci</Text>
        </View>

        <Text style={styles.warningText}>
          {isPinned
            ? 'Aplikasi dipin — segera kembali ke ujian sebelum hitungan mundur berakhir!'
            : isExpoGo
              ? 'Anda keluar dari aplikasi — kembali sebelum 5 detik atau kuis akan dikunci.'
              : 'Peringatan: Anda keluar dari layar ujian. Segera kembali sebelum hitungan habis!'}
        </Text>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: activeColor }]}
          onPress={onReenter}
          activeOpacity={0.88}
        >
          <Ionicons name="shield-checkmark" size={18} color="#FFF" />
          <Text style={styles.ctaText}>Kembali Mengerjakan Kuis</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Jika hitungan mencapai 0, ujian otomatis dikunci &amp; memerlukan persetujuan pengawas.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 16 },
  countdownCard: {
    width: '100%',
    maxWidth: 312,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'rgba(21, 26, 42, 0.85)',
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  countdownNumber: { fontSize: 60, fontWeight: '900', lineHeight: 60, fontVariant: ['tabular-nums'] as any },
  countdownHint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  warningText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  footnote: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 300,
    lineHeight: 16,
  },
});
