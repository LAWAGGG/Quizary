import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMySubmissions, getSubmissionDetail, getMe } from '../../services/api_service';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { useAppTheme } from '../../context/ThemeContext';
import { QuickJoinBanner } from '../../components/QuickJoinBanner';
import { SubmissionHistoryCard } from '../../components/SubmissionHistoryCard';
import { SubmissionDetailModal } from '../../components/SubmissionDetailModal';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [selectedSubItem, setSelectedSubItem] = useState<any>(null);
  const [subDetail, setSubDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [subRes, userRes] = await Promise.all([
        getMySubmissions().catch(() => null),
        getMe().catch(() => null),
      ]);
      if (subRes) {
        const list = Array.isArray(subRes) ? subRes : subRes.data || [];
        const completedList = list.filter((item: any) => item.status !== 'in_progress');
        setSubmissions(completedList);
      }
      if (userRes) setUser(userRes);
    } catch (e) {
      console.log('Error loading respondent history', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openSubDetail = async (subItem: any) => {
    setSelectedSubItem(subItem);
    setSelectedSubId(subItem.id);
    setLoadingDetail(true);
    setSubDetail(null);
    try {
      const res = await getSubmissionDetail(subItem.id);
      setSubDetail(res);
    } catch (e) {
      console.log('Error fetching detail for ID', subItem.id, e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedSubId(null);
    setSelectedSubItem(null);
    setSubDetail(null);
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Responden';
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* User Header */}
        <View style={styles.userHeader}>
          <View>
            <Text style={[styles.greetingEyebrow, { color: colors.primary }]}>DASHBOARD RESPONDEN</Text>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>Halo, {firstName}! 👋</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ThemeToggleBtn />
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: colors.primarySoft, borderColor: colors.inputBorder }]}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modular Banner: Scan QR & Quick Join */}
        <QuickJoinBanner />

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Riwayat Pengisian Form</Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{submissions.length} Kuis/Form</Text>
        </View>

        {/* Submissions List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSub, marginTop: 12 }}>Memuat riwayat...</Text>
          </View>
        ) : submissions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Belum Ada Riwayat</Text>
            <Text style={[styles.emptySub, { color: colors.textSub }]}>
              Pindai QR Code atau masukkan link kuis dari guru/pengawas untuk mulai mengerjakan.
            </Text>
          </View>
        ) : (
          submissions.map((sub) => (
            <SubmissionHistoryCard key={sub.id} item={sub} onPress={() => openSubDetail(sub)} />
          ))
        )}
      </ScrollView>

      {/* Modular Submission Detail Modal */}
      <SubmissionDetailModal
        visible={selectedSubId !== null}
        selectedSubItem={selectedSubItem}
        subDetail={subDetail}
        loadingDetail={loadingDetail}
        user={user}
        onClose={closeModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 54, paddingBottom: 40 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greetingEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  greetingTitle: { fontSize: 22, fontWeight: 'bold' },
  avatarBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  centerLoading: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: { borderRadius: 16, padding: 32, borderWidth: 1, alignItems: 'center', gap: 8, marginTop: 10 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
