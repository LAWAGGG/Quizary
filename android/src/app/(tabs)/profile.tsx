import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getMe, updateProfile, apiLogout, removeToken, getStoredUser, saveUser, BASE_URL } from '../../services/api_service';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { useAppTheme } from '../../context/ThemeContext';
import { useAppAlert } from '../../context/AlertContext';

export default function ProfileScreen() {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const { showAlert } = useAppAlert();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Preview avatar yang BARU DIPILIH tapi belum di-upload ke server
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

  const extractUserData = (data: any) => {
    if (!data) return null;
    if (data.user) return data.user;
    if (data.data) return data.data;
    return data;
  };

  const loadProfile = useCallback(async () => {
    try {
      const cached = await getStoredUser();
      if (cached) {
        setUser(cached);
        setName(cached.name || '');
      }
    } catch (e) {
      console.log('[DEBUG PROFILE] Failed to get stored user:', e);
    }

    try {
      const response = await getMe();
      const userData = extractUserData(response);
      if (userData) {
        setUser(userData);
        setName(userData.name || '');
        await saveUser(userData);
      }
    } catch (err: any) {
      console.log('[DEBUG PROFILE] Failed to fetch user profile via getMe():', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  // Cuma milih gambar & nampilin preview lokal — BELUM upload
  const handlePickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPendingAvatarUri(res.assets[0].uri);
      }
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Error' : 'Error',
        message: err.message || (language === 'ID' ? 'Gagal memilih gambar.' : 'Failed to pick image.'),
      });
    }
  };

  // Batal — buang preview, balik ke avatar lama
  const handleCancelAvatar = () => {
    setPendingAvatarUri(null);
  };

  // Baru di titik INI request upload beneran dikirim ke server
  const handleSaveAvatar = async () => {
    if (!pendingAvatarUri) return;
    setUploadingAvatar(true);
    try {
      const response = await updateProfile({ avatar: pendingAvatarUri });
      const updatedUser = extractUserData(response);
      if (updatedUser) {
        setUser(updatedUser);
        await saveUser(updatedUser);
      } else {
        const fresh = await getMe();
        const freshData = extractUserData(fresh);
        if (freshData) {
          setUser(freshData);
          await saveUser(freshData);
        }
      }
      setPendingAvatarUri(null);
      showAlert({
        type: 'success',
        title: language === 'ID' ? 'Sukses 🎉' : 'Success 🎉',
        message: language === 'ID' ? 'Avatar berhasil diperbarui' : 'Avatar updated successfully',
      });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Gagal Mengubah Avatar' : 'Failed to Update Avatar',
        message: e.message || (language === 'ID' ? 'Terjadi kesalahan saat mengunggah avatar.' : 'An error occurred while uploading avatar.'),
      });
      // Preview TETAP ditampilkan biar user tau apa yang dipilih, walau upload gagal
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Field Wajib' : 'Required Field',
        message: language === 'ID' ? 'Nama tidak boleh kosong.' : 'Name cannot be empty.',
      });
      return;
    }
    setSaving(true);
    try {
      const response = await updateProfile({ name: name.trim() });
      const updatedUser = extractUserData(response);

      if (updatedUser) {
        setUser(updatedUser);
        setName(updatedUser.name || name.trim());
        await saveUser(updatedUser);
      } else {
        const freshUser = await getMe();
        const freshData = extractUserData(freshUser);
        if (freshData) {
          setUser(freshData);
          setName(freshData.name || name.trim());
          await saveUser(freshData);
        }
      }

      showAlert({
        type: 'success',
        title: language === 'ID' ? 'Profil Diperbarui 🎉' : 'Profile Updated 🎉',
        message: language === 'ID' ? 'Profil berhasil disimpan' : 'Profile saved successfully',
      });
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: language === 'ID' ? 'Update Gagal' : 'Update Failed',
        message: err.message || (language === 'ID' ? 'Gagal memperbarui profil.' : 'Failed to update profile.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    showAlert({
      type: 'confirm',
      title: language === 'ID' ? 'Konfirmasi Logout' : 'Logout Confirmation',
      message: language === 'ID' ? 'Apakah Anda yakin ingin keluar dari akun?' : 'Are you sure you want to log out?',
      confirmText: language === 'ID' ? 'Logout' : 'Logout',
      cancelText: language === 'ID' ? 'Batal' : 'Cancel',
      onConfirm: async () => {
        try {
          await apiLogout().catch(() => null);
        } finally {
          await removeToken();
          router.replace('/');
        }
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>
          {language === 'ID' ? 'Memuat profil...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  // Sumber gambar avatar: preview lokal (kalau ada) > avatar tersimpan di server > inisial huruf
  const resolvedAvatarSource = pendingAvatarUri
    ? { uri: pendingAvatarUri }
    : user?.avatar
    ? {
        uri: user.avatar.startsWith('http')
          ? `${user.avatar}?t=${Date.now()}`
          : `${BASE_URL.replace('/api', '')}${user.avatar}?t=${Date.now()}`,
      }
    : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Workspace Header */}
      <View style={styles.topWorkspaceRow}>
        <Text style={[styles.workspaceText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
          {language === 'ID' ? `Profil ${user?.name || 'Responden'}` : `${user?.name || 'Respondent'}'s Profile`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemeToggleBtn />
          <View style={[styles.userAvatarBtn, { backgroundColor: colors.primarySoft, borderColor: isDark ? colors.cardBorder : '#C7D2FE' }]}>
            {resolvedAvatarSource ? (
              <Image source={resolvedAvatarSource} style={styles.userAvatarImg} />
            ) : (
              <Text style={[styles.userAvatarText, { color: colors.primary, fontSize: 14 * fontSizeScale }]}>{initial}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Page Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary, fontSize: 11 * fontSizeScale }]}>
          {language === 'ID' ? 'AKUN' : 'ACCOUNT'}
        </Text>
        <Text style={[styles.title, { color: colors.text, fontSize: 26 * fontSizeScale }]}>
          {language === 'ID' ? 'Profil Saya' : 'My Profile'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>
          {language === 'ID' ? 'Perbarui nama dan avatar akun Anda.' : 'Update your account name and avatar.'}
        </Text>
      </View>

      {/* Avatar Card */}
      <View style={[styles.avatarCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            style={[styles.avatarCircle, { backgroundColor: colors.primarySoft, borderColor: isDark ? colors.cardBorder : '#FFFFFF' }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            {uploadingAvatar ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : resolvedAvatarSource ? (
              <Image source={resolvedAvatarSource} style={styles.avatarLargeImg} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary, fontSize: 32 * fontSizeScale }]}>
                {initial}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cameraBadge, { backgroundColor: colors.primary }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.85}
          >
            <Ionicons name="camera" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tombol Save/Cancel Avatar — muncul HANYA kalau ada preview baru yang belum disimpan */}
        {pendingAvatarUri && (
          <View style={styles.avatarActionRow}>
            <TouchableOpacity
              style={[styles.avatarSaveBtn, { backgroundColor: colors.primary }, uploadingAvatar && styles.btnDisabled]}
              onPress={handleSaveAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.85}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.avatarSaveBtnText}>
                  {language === 'ID' ? 'Simpan Avatar' : 'Save Avatar'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancelAvatar} disabled={uploadingAvatar} style={styles.avatarCancelBtn}>
              <Text style={[styles.avatarCancelBtnText, { color: colors.textSub }]}>
                {language === 'ID' ? 'Batal' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.userName, { color: colors.text, fontSize: 20 * fontSizeScale, marginTop: pendingAvatarUri ? 16 : 0 }]}>
          {user?.name || (language === 'ID' ? 'Responden' : 'Respondent')}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>{user?.email || 'email@quizary.id'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: isDark ? '#2F2690' : '#F0EFFF', borderColor: isDark ? '#6C5CE7' : '#D5D0FA' }]}>
          <Text style={[styles.roleBadgeText, { color: '#6C5CE7', fontSize: 11 * fontSizeScale }]}>
            {user?.role ? user.role.toUpperCase() : 'USER'}
          </Text>
        </View>
      </View>

      {/* Profile Form Card */}
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[styles.label, { color: colors.text, fontSize: 13 * fontSizeScale }]}>
          {language === 'ID' ? 'Nama' : 'Name'}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder, fontSize: 15 * fontSizeScale }]}
          placeholder={language === 'ID' ? 'Nama Anda' : 'Your name'}
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: colors.text, fontSize: 13 * fontSizeScale, marginTop: 14 }]}>Email</Text>
        <TextInput
          style={[styles.input, styles.disabledInput, { backgroundColor: colors.itemBg, color: colors.textSub, borderColor: colors.inputBorder, fontSize: 15 * fontSizeScale }]}
          value={user?.email || ''}
          editable={false}
        />
        <Text style={[styles.fieldHint, { color: colors.textMuted, fontSize: 12 * fontSizeScale }]}>
          {language === 'ID' ? 'Email tidak dapat diubah.' : 'Email cannot be changed.'}
        </Text>

        <TouchableOpacity
          style={[styles.btnSave, { backgroundColor: colors.primary }, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.btnSaveText, { fontSize: 15 * fontSizeScale }]}>
              {language === 'ID' ? 'Simpan Perubahan' : 'Save Changes'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.btnLogout, { backgroundColor: colors.cardBg, borderColor: isDark ? '#7F1D1D' : '#FEE2E2' }]}
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <Ionicons name="log-out-outline" size={18} color={isDark ? '#FCA5A5' : '#EF4444'} />
        <Text style={[styles.btnLogoutText, { color: isDark ? '#FCA5A5' : '#EF4444', fontSize: 15 * fontSizeScale }]}>
          {language === 'ID' ? 'Keluar' : 'Logout'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: {},
  topWorkspaceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  workspaceText: { fontWeight: '600' },
  userAvatarBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden',
  },
  userAvatarImg: { width: '100%', height: '100%', borderRadius: 17 },
  userAvatarText: { fontWeight: 'bold' },
  header: { marginBottom: 20 },
  eyebrow: { fontWeight: '800', letterSpacing: 1.2 },
  title: { fontWeight: 'bold', marginTop: 2, marginBottom: 2 },
  subtitle: {},
  avatarCard: {
    borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 16, borderWidth: 1, elevation: 1,
  },
  avatarWrapper: {
    position: 'relative', marginBottom: 12,
  },
  avatarCircle: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, shadowColor: '#6C5CE7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6,
    overflow: 'hidden',
  },
  avatarLargeImg: { width: '100%', height: '100%', borderRadius: 42 },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    elevation: 3,
  },
  avatarText: { fontWeight: 'bold' },
  avatarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  avatarSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  avatarSaveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  avatarCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  avatarCancelBtnText: { fontWeight: '600', fontSize: 14 },
  userName: { fontWeight: 'bold', marginBottom: 2 },
  userEmail: { marginBottom: 10 },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
  },
  roleBadgeText: { fontWeight: 'bold' },
  card: {
    borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, elevation: 1,
  },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  disabledInput: {},
  fieldHint: { marginTop: 4, marginBottom: 16 },
  btnSave: {
    paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', elevation: 1,
  },
  btnDisabled: { opacity: 0.6 },
  btnSaveText: { color: '#FFFFFF', fontWeight: 'bold' },
  btnLogout: {
    borderWidth: 1, paddingVertical: 14, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnLogoutText: { fontWeight: '600' },
});