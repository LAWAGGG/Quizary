import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Image, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMySubmissions, getSubmissionDetail, getMe, getStoredUser, finalizeSubmission, BASE_URL } from '../../services/api_service';
import { isSubmissionExpired } from '../../utils/api';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { useAppTheme } from '../../context/ThemeContext';
import { QuickJoinBanner } from '../../components/QuickJoinBanner';
import { SubmissionHistoryCard } from '../../components/SubmissionHistoryCard';
import { SubmissionDetailModal } from '../../components/SubmissionDetailModal';


export default function HomeScreen() {
  const { colors, language, fontSizeScale } = useAppTheme();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const flatListRef = useRef<any>(null);

  // Modal states
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [selectedSubItem, setSelectedSubItem] = useState<any>(null);
  const [subDetail, setSubDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const PER_PAGE = 20;

  const fetchUser = useCallback(async () => {
    try {
      const stored = await getStoredUser();
      if (stored) setUser(stored);
      const userRes = await getMe().catch(() => null);
      if (userRes) setUser(userRes);
    } catch {}
  }, []);

  const isFetchingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum: number, isRefresh = false, silent = false) => {
    if (!silent && isFetchingRef.current) return;
    if (!silent) {
      isFetchingRef.current = true;
      if (isRefresh) {
        setLoading(true);
      } else if (pageNum > 1) {
        setLoadingMore(true);
      }
    }
    try {
      const res: any = await getMySubmissions({ page: pageNum, per_page: PER_PAGE }).catch(() => null);
      if (res) {
        const rawList: any[] = Array.isArray(res) ? res : res.data || [];
        const list: any[] = rawList
          .filter((it: any) => it && typeof it === 'object' && it.id != null)
          .map((it: any) => {
            if (it.status === 'in_progress' && isSubmissionExpired(it)) {
              finalizeSubmission(it.id).catch(() => {});
              return { ...it, status: 'auto_submitted' };
            }
            return it;
          });
        const meta = res?.meta;
        const serverTotal = meta?.total;
        if (typeof serverTotal === 'number') setTotal(serverTotal);

        if (silent && (isRefresh || pageNum === 1)) {
          // silent polling: upsert tanpa reset scroll, biar status langsung update tanpa flicker
          setSubmissions((prev) => {
            if (prev.length === 0) return list;
            const merged = [...prev];
            for (const item of list) {
              const existingIdx = merged.findIndex((p: any) => p.id === item.id);
              if (existingIdx !== -1) {
                if (JSON.stringify(merged[existingIdx]) !== JSON.stringify(item)) {
                  merged[existingIdx] = item;
                }
              } else {
                merged.unshift(item);
              }
            }
            return merged;
          });
        } else if (isRefresh || pageNum === 1) {
          setSubmissions(list);
          if (list.length === 0 || list.length < PER_PAGE) {
            setHasMore(false);
          } else if (typeof serverTotal === 'number') {
            setHasMore(list.length < serverTotal);
          } else {
            setHasMore(true);
          }
          setPage(1);
        } else {
          // Pagination: Deduplicate new items to prevent infinite scroll item duplication
          let addedCount = 0;
          setSubmissions((prev) => {
            const existingIds = new Set(prev.map((p: any) => p.id));
            const uniqueNew = list.filter((p: any) => !existingIds.has(p.id));
            addedCount = uniqueNew.length;
            if (uniqueNew.length > 0) {
              const updated = [...prev, ...uniqueNew];
              if (typeof serverTotal === 'number') {
                setHasMore(updated.length < serverTotal);
              }
              return updated;
            }
            return prev;
          });

          if (addedCount === 0 || list.length < PER_PAGE) {
            setHasMore(false);
          }
          setPage(pageNum);
        }
      } else if (isRefresh || pageNum === 1) {
        setSubmissions([]);
        setHasMore(false);
        setTotal(0);
      }
    } catch (e) {
      console.log('Error loading submissions page', pageNum, e);
    } finally {
      if (!silent) {
        isFetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([fetchUser(), fetchPage(1, true)]);
  }, [fetchUser, fetchPage]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // polling silent tiap 4 detik biar status auto_submitted/cheating/locked langsung kelihatan tanpa refresh manual
      const id = setInterval(() => {
        fetchPage(1, true, true);
        fetchUser().catch(() => {});
      }, 4000);
      return () => clearInterval(id);
    }, [loadData, fetchPage, fetchUser])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    fetchPage(1, true);
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore || isFetchingRef.current) return;
    fetchPage(page + 1);
  }, [loading, loadingMore, refreshing, hasMore, page, fetchPage]);

  const openSubDetail = async (subItem: any) => {
    const isExpired = isSubmissionExpired(subItem);

    // Khusus in_progress yang belum expired: langsung lanjut mengerjakan
    if (subItem.status === 'in_progress' && !isExpired) {
      const shortCode = subItem.short_code;
      if (shortCode) {
        router.push({ pathname: '/quiz', params: { shortCode: shortCode, resumeSubmissionId: String(subItem.id) } } as any);
      } else {
        try {
          const detail: any = await getSubmissionDetail(subItem.id);
          const code = detail?.short_code;
          if (code) {
            router.push({ pathname: '/quiz', params: { shortCode: code, resumeSubmissionId: String(subItem.id) } } as any);
          } else {
            router.push({ pathname: '/quiz', params: { submissionId: String(subItem.id) } } as any);
          }
        } catch {
          router.push({ pathname: '/quiz', params: { submissionId: String(subItem.id) } } as any);
        }
      }
      return;
    }

    // Jika in_progress tetapi expired: auto update status ke server & local
    if (subItem.status === 'in_progress' && isExpired) {
      subItem.status = 'auto_submitted';
      finalizeSubmission(subItem.id).catch(() => {});
    }
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

  const handleContinue = (item: any, detail: any) => {
    const sid = item?.id || detail?.id;
    const code = item?.short_code || detail?.short_code;
    closeModal();
    if (code) {
      router.push({ pathname: '/quiz', params: { shortCode: code, resumeSubmissionId: String(sid) } } as any);
    } else if (sid) {
      router.push({ pathname: '/quiz', params: { submissionId: String(sid) } } as any);
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : (language === 'ID' ? 'Responden' : 'Respondent');
  const initial = firstName.charAt(0).toUpperCase();

  const renderItem = useCallback(({ item }: { item: any }) => (
    <SubmissionHistoryCard item={item} onPress={() => openSubDetail(item)} />
  ), []);

  const ListHeader = useCallback(() => (
    <View>
      {/* User Header */}
      <View style={styles.userHeader}>
        <View>
          <Text style={[styles.greetingEyebrow, { color: colors.primary, fontSize: 11 * fontSizeScale }]}>
            {language === 'ID' ? 'DASHBOARD RESPONDEN' : 'RESPONDENT DASHBOARD'}
          </Text>
          <Text style={[styles.greetingTitle, { color: colors.text, fontSize: 22 * fontSizeScale }]}>
            {language === 'ID' ? `Halo, ${firstName}!` : `Hello, ${firstName}!`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ThemeToggleBtn />
          <TouchableOpacity
            style={[styles.avatarBtn, { backgroundColor: colors.primarySoft, borderColor: colors.inputBorder, overflow: 'hidden' }]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            {user?.avatar ? (
              <Image
              source={{
                uri: user.avatar.startsWith('http')
                ? `${user.avatar}?t=${Date.now()}`
                : `${BASE_URL.replace('/api', '')}${user.avatar}?t=${Date.now()}`,
              }}
              style={styles.avatarImg}
              />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary, fontSize: 16 * fontSizeScale }]}>{initial}</Text>
            )} 
          </TouchableOpacity>
        </View>
      </View>

      {/* Modular Banner: Scan QR & Quick Join */}
      <QuickJoinBanner />

      {/* Section Title (Matching Web Design with Bilingual Support) */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrowText, { color: colors.primary, fontSize: 11 * fontSizeScale }]}>
          {language === 'ID' ? 'AKTIVITAS ANDA' : 'YOUR ACTIVITY'}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 22 * fontSizeScale }]}>
            {language === 'ID' ? 'Jawaban Saya' : 'My Submissions'}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted, fontSize: 13 * fontSizeScale }]}>
              {(total ?? submissions.length)} {language === 'ID' ? 'Kuis/Form' : 'Quiz/Form'}
            </Text>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
          {language === 'ID'
            ? 'Semua form atau kuis yang telah Anda jawab.'
            : 'Every form or quiz you\'ve answered.'}
        </Text>
      </View>
    </View>
  ), [colors, language, fontSizeScale, firstName, initial, submissions.length, total]);

  const ListEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSub, marginTop: 12, fontSize: 14 * fontSizeScale }}>
            {language === 'ID' ? 'Memuat riwayat...' : 'Loading history...'}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 16 * fontSizeScale }]}>
          {language === 'ID' ? 'Belum Ada Riwayat' : 'No History Yet'}
        </Text>
        <Text style={[styles.emptySub, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
          {language === 'ID'
            ? 'Pindai QR Code atau masukkan link kuis dari guru/pengawas untuk mulai mengerjakan.'
            : 'Scan QR Code or enter quiz link from teacher/supervisor to get started.'}
        </Text>
      </View>
    );
  }, [loading, colors, language, fontSizeScale]);

  const ListFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.textSub, marginTop: 8, fontSize: 13 * fontSizeScale }}>
            {language === 'ID' ? 'Memuat lebih banyak...' : 'Loading more...'}
          </Text>
        </View>
      );
    }
    if (!hasMore && submissions.length > 0) {
      return (
        <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12 * fontSizeScale, paddingVertical: 16 }}>
          {language === 'ID' ? 'Semua riwayat telah dimuat' : 'All history loaded'}
        </Text>
      );
    }
    return null;
  }, [loadingMore, hasMore, submissions.length, colors, language, fontSizeScale]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={flatListRef as any}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 150) {
            onEndReached();
          }
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {ListHeader()}
        {loading && submissions.length === 0 ? (
          ListEmpty()
        ) : submissions.length === 0 ? (
          ListEmpty()
        ) : (
          <>
            {submissions
              .filter((it: any) => it && typeof it === 'object' && it.id != null)
              .map((item, idx) => (
                <SubmissionHistoryCard
                  key={`sub-${item.id ?? idx}`}
                  item={item}
                  onPress={() => openSubDetail(item)}
                />
              ))}
            {ListFooter()}
          </>
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
        onContinue={handleContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 54, paddingBottom: 40 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greetingEyebrow: { fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  greetingTitle: { fontWeight: 'bold' },
  avatarBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: 'bold' },
  sectionHeader: { marginBottom: 14 },
  eyebrowText: { fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  sectionTitle: { fontWeight: 'bold' },
  sectionCount: { fontWeight: '600' },
  sectionSub: { marginTop: 2, fontWeight: '400' },
  centerLoading: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: { borderRadius: 16, padding: 32, borderWidth: 1, alignItems: 'center', gap: 8, marginTop: 10 },
  emptyTitle: { fontWeight: 'bold' },
  emptySub: { textAlign: 'center', lineHeight: 18 },
  avatarImg: { width: '100%', height: '100%'},
});