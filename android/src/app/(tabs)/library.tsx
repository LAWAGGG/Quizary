import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchMyForms, publishForm, deleteForm, getMe } from '../services/api_service';

export default function LibraryScreen() {
  const [forms, setForms] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'closed'>('all');

  const loadForms = useCallback(async () => {
    try {
      const [res, userRes] = await Promise.all([
        fetchMyForms().catch(() => null),
        getMe().catch(() => null),
      ]);
      setForms(res?.data || res || []);
      if (userRes) setUser(userRes);
    } catch (error: any) {
      console.log('Failed to fetch forms', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const onRefresh = () => {
    setRefreshing(true);
    loadForms();
  };

  const handlePublish = async (id: number | string) => {
    try {
      await publishForm(id);
      Alert.alert('Sukses 🎉', 'Form berhasil dipublikasikan!');
      loadForms();
    } catch (err: any) {
      Alert.alert('Gagal Publikasi', err.message || 'Form minimal harus memiliki 1 soal.');
    }
  };

  const handleDelete = (id: number | string, title: string) => {
    Alert.alert(
      'Hapus Form',
      `Apakah Anda yakin ingin menghapus "${title}"? Seluruh data soal dan jawaban responden akan terhapus secara permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteForm(id);
              Alert.alert('Terhapus', 'Form berhasil dihapus.');
              loadForms();
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message || 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  const filteredForms = forms.filter((f) => {
    const matchesSearch = searchQuery.trim() === '' || f.title?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'published') return f.status === 'published';
    if (filter === 'draft') return f.status === 'draft';
    if (filter === 'closed') return f.status === 'closed';
    return true;
  });

  const initial = (user?.name || 'C').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top Workspace Header */}
      <View style={styles.topWorkspaceRow}>
        <Text style={styles.workspaceText}>{user?.name || 'Creator'}'s workspace</Text>
        <TouchableOpacity style={styles.userAvatarBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.userAvatarText}>{initial}</Text>
        </TouchableOpacity>
      </View>

      {/* Page Header with Action Button */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.eyebrow}>YOUR FORMS</Text>
          <Text style={styles.title}>Forms</Text>
          <Text style={styles.subtitle}>Create, manage, and share your forms and quizzes.</Text>
        </View>
        <TouchableOpacity style={styles.btnPrimaryTop} onPress={() => router.push('/(tabs)/create')}>
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.btnPrimaryText}>Create New Form</Text>
        </TouchableOpacity>
      </View>

      {/* Filter and Search Bar Row */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search forms..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterChipsRow}>
          {(['all', 'draft', 'published', 'closed'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'draft' ? 'Draft' : f === 'published' ? 'Published' : 'Closed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main Forms Container */}
      <View style={styles.mainCard}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Loading forms...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredForms}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
            renderItem={({ item }) => (
              <View style={styles.formItemCard}>
                <View style={styles.formItemHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.formItemTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.formItemDesc} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, item.status === 'published' ? styles.badgePublished : styles.badgeDraft]}>
                    <Text style={[styles.statusBadgeText, item.status === 'published' ? styles.textPublished : styles.textDraft]}>
                      {item.status === 'published' ? 'Published' : 'Draft'}
                    </Text>
                  </View>
                </View>

                <View style={styles.formItemMetaRow}>
                  <View style={styles.metaBadge}>
                    <Ionicons name="pricetag-outline" size={12} color="#64748B" />
                    <Text style={styles.metaBadgeText}>{item.type === 'quiz' ? 'Quiz' : 'Form'}</Text>
                  </View>
                  {item.short_code && (
                    <Text style={styles.codeText}>Token: #{item.short_code}</Text>
                  )}
                  <Text style={styles.metaBadgeText}>{item.submission_count ?? 0} answers</Text>
                </View>

                <View style={styles.formItemFooterActions}>
                  {item.status === 'draft' ? (
                    <TouchableOpacity style={styles.publishBtn} onPress={() => handlePublish(item.id)}>
                      <Ionicons name="cloud-upload-outline" size={14} color="#FFF" />
                      <Text style={styles.publishBtnText}>Publish</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.title)}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="document-text-outline" size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No forms yet</Text>
                <Text style={styles.emptySubtitle}>Create a form or quiz and share it with anyone.</Text>
                <TouchableOpacity style={styles.btnPrimaryEmpty} onPress={() => router.push('/(tabs)/create')}>
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>Create New Form</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, paddingTop: 50 },
  topWorkspaceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  workspaceText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  userAvatarBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C7D2FE',
  },
  userAvatarText: { color: '#6366F1', fontWeight: 'bold', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTextCol: { flex: 1, paddingRight: 10 },
  eyebrow: { color: '#6366F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#0F172A', fontSize: 26, fontWeight: 'bold', marginTop: 2, marginBottom: 2 },
  subtitle: { color: '#64748B', fontSize: 14 },
  btnPrimaryTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
  },
  btnPrimaryEmpty: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#6366F1', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10,
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  searchFilterContainer: { marginBottom: 16, gap: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 14, padding: 0 },
  filterChipsRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  chipText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#6366F1' },
  mainCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: '#F1F5F9', elevation: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { color: '#64748B' },
  listContent: { paddingVertical: 8, gap: 12 },
  emptyContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  emptyTitle: { color: '#0F172A', fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  emptySubtitle: { color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  formItemCard: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 10,
  },
  formItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  formItemTitle: { color: '#0F172A', fontSize: 15, fontWeight: 'bold' },
  formItemDesc: { color: '#64748B', fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePublished: { backgroundColor: '#ECFDF5' },
  badgeDraft: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  textPublished: { color: '#10B981' },
  textDraft: { color: '#D97706' },
  formItemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaBadgeText: { color: '#64748B', fontSize: 12 },
  codeText: { color: '#6366F1', fontSize: 12, fontWeight: 'bold' },
  formItemFooterActions: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8,
  },
  publishBtn: {
    backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  publishBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  deleteBtn: {
    backgroundColor: '#FEE2E2', padding: 6, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
});
