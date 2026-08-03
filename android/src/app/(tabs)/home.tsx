import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardSummary, getMe } from '../services/api_service';

export default function HomeScreen() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [summaryRes, userRes] = await Promise.all([
        getDashboardSummary().catch(() => null),
        getMe().catch(() => null),
      ]);
      if (summaryRes) setData(summaryRes);
      if (userRes) setUser(userRes);
    } catch (e) {
      console.log('Error loading dashboard summary', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Creator';
  const initial = firstName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  const STATS = [
    { key: 'total_forms', label: 'Total Forms', count: data?.total_forms ?? 0, icon: 'document-text-outline', color: '#6366F1', bg: '#EEF2FF' },
    { key: 'total_quiz', label: 'Quiz', count: data?.total_quiz ?? 0, icon: 'help-circle-outline', color: '#3B82F6', bg: '#EFF6FF' },
    { key: 'total_submissions', label: 'Submissions', count: data?.total_submissions ?? 0, icon: 'paper-plane-outline', color: '#10B981', bg: '#ECFDF5' },
    { key: 'total_respondents', label: 'Respondents', count: data?.total_respondents ?? 0, icon: 'people-outline', color: '#F59E0B', bg: '#FEF3C7' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Top Workspace Header */}
      <View style={styles.topWorkspaceRow}>
        <Text style={styles.workspaceText}>{user?.name || 'Creator'}'s workspace</Text>
        <TouchableOpacity style={styles.userAvatarBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.userAvatarText}>{initial}</Text>
        </TouchableOpacity>
      </View>

      {/* Page Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>DASHBOARD</Text>
          <Text style={styles.title}>Welcome back, {firstName}</Text>
          <Text style={styles.subtitle}>Here's how your forms are performing.</Text>
        </View>
      </View>

      {/* Header Actions */}
      <View style={styles.headerActionsRow}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(tabs)/library')}>
          <Ionicons name="eye-outline" size={16} color="#0F172A" />
          <Text style={styles.btnSecondaryText}>All Forms</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(tabs)/create')}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.btnPrimaryText}>New Form</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {STATS.map((item, idx) => (
          <View key={idx} style={styles.statCard}>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statCount}>{item.count}</Text>
            </View>
            <View style={[styles.statIconBox, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
          </View>
        ))}
      </View>

      {/* Main Content Cards */}
      <View style={styles.sectionCardsCol}>
        {/* Recent Forms Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Recent Forms</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
              <Text style={styles.viewAllLink}>View all</Text>
            </TouchableOpacity>
          </View>

          {!data?.recent_forms || data.recent_forms.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No forms yet — create one to start collecting answers.</Text>
              <TouchableOpacity style={styles.createFormBtn} onPress={() => router.push('/(tabs)/create')}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={styles.createFormBtnText}>Create a Form</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.recentList}>
              {data.recent_forms.map((f: any) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.recentItemRow}
                  onPress={() => router.push('/(tabs)/library')}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.recentItemTitle} numberOfLines={1}>{f.title}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.statusBadge, f.status === 'published' ? styles.statusPublished : styles.statusDraft]}>
                        <Text style={[styles.statusBadgeText, f.status === 'published' ? styles.statusTextPublished : styles.statusTextDraft]}>
                          {f.status === 'published' ? 'Published' : 'Draft'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.answersCount}>{f.submission_count ?? 0} answers</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Submission Trend Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trending-up" size={18} color="#6366F1" />
              <Text style={styles.cardHeaderTitle}>Submission Trend</Text>
            </View>
          </View>

          <View style={styles.trendEmptyContainer}>
            <Text style={styles.bigZero}>0</Text>
            <Text style={styles.trendEmptyText}>Answers will show up here as they come in.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', gap: 8 },
  loadingText: { color: '#64748B', marginTop: 8, fontSize: 14 },
  topWorkspaceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  workspaceText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  userAvatarBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C7D2FE',
  },
  userAvatarText: { color: '#6366F1', fontWeight: 'bold', fontSize: 14 },
  header: { marginBottom: 12 },
  eyebrow: { color: '#6366F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#0F172A', fontSize: 26, fontWeight: 'bold', marginTop: 2, marginBottom: 2 },
  subtitle: { color: '#64748B', fontSize: 14 },
  headerActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
  },
  btnSecondaryText: { color: '#0F172A', fontWeight: '600', fontSize: 14 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
    elevation: 2, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: {
    width: '48%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderWidth: 1, borderColor: '#F1F5F9', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  statContent: { flex: 1 },
  statLabel: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  statCount: { color: '#0F172A', fontSize: 28, fontWeight: 'bold', marginTop: 8 },
  statIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionCardsCol: { gap: 16 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: '#F1F5F9', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardHeaderTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  viewAllLink: { color: '#6366F1', fontSize: 13, fontWeight: '600' },
  emptyContainer: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  createFormBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
  },
  createFormBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  recentList: { gap: 10 },
  recentItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  recentItemTitle: { color: '#0F172A', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusPublished: { backgroundColor: '#ECFDF5' },
  statusDraft: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusTextPublished: { color: '#10B981' },
  statusTextDraft: { color: '#D97706' },
  answersCount: { color: '#64748B', fontSize: 13 },
  trendEmptyContainer: { height: 140, alignItems: 'center', justifyContent: 'center' },
  bigZero: { fontSize: 44, fontWeight: 'bold', color: '#CBD5E1' },
  trendEmptyText: { color: '#94A3B8', fontSize: 13, marginTop: 4, textAlign: 'center' },
});
