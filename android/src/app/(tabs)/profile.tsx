import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getMe, updateProfile, apiLogout, removeToken, getStoredUser, saveUser } from '../../services/api_service';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { useAppTheme } from '../../context/ThemeContext';
import { BASE_URL } from '@/services/api_service';

export default function ProfileScreen() {
  const { colors, isDark, language, fontSizeScale } = useAppTheme();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const extractUserData = (data: any) => {
    if (!data) return null;
    if (data.user) return data.user;
    if (data.data) return data.data;
    return data;
  };

  const loadProfile = useCallback(async () => {
    // 1. Load instantly from cache if available
    try {
      const cached = await getStoredUser();
      console.log('[DEBUG PROFILE] Cached user in SecureStore:', JSON.stringify(cached));
      if (cached) {
        setUser(cached);
        setName(cached.name || '');
      }
    } catch (e) {
      console.log('[DEBUG PROFILE] Failed to get stored user:', e);
    }

    // 2. Fetch fresh user data from server
    try {
      const response = await getMe();
      console.log('[DEBUG PROFILE] getMe response:', JSON.stringify(response));
      const userData = extractUserData(response);
      console.log('[DEBUG PROFILE] extracted userData:', JSON.stringify(userData));
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

  const handlePickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('[DEBUG AVATAR] ImagePicker result:', JSON.stringify(res));

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const pickedUri = res.assets[0].uri;
        console.log('[DEBUG AVATAR] Picked image URI:', pickedUri);
        setUploadingAvatar(true);
        try {
          console.log('[DEBUG AVATAR] Calling updateProfile with avatar...');
          const response = await updateProfile({ avatar: pickedUri });
          console.log('[DEBUG AVATAR] updateProfile response:', JSON.stringify(response));
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
          Alert.alert(
            language === 'ID' ? 'Sukses 🎉' : 'Success 🎉',
            language === 'ID' ? 'Avatar berhasil diperbarui' : 'Avatar updated successfully'
          );
        } catch (e: any) {
          console.log('[DEBUG AVATAR] updateProfile error:', e);
          Alert.alert(
            language === 'ID' ? 'Gagal Mengubah Avatar' : 'Failed to Update Avatar',
            e.message || (language === 'ID' ? 'Terjadi kesalahan saat mengunggah avatar.' : 'An error occurred while uploading avatar.')
          );
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (err: any) {
      console.log('[DEBUG AVATAR] launchImageLibraryAsync error:', err);
      Alert.alert(
        language === 'ID' ? 'Error' : 'Error',
        err.message || (language === 'ID' ? 'Gagal memilih gambar.' : 'Failed to pick image.')
      );
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        language === 'ID' ? 'Field Wajib' : 'Required Field',
        language === 'ID' ? 'Nama tidak boleh kosong.' : 'Name cannot be empty.'
      );
      return;
    }
    setSaving(true);
    try {
      console.log('[DEBUG PROFILE] Calling updateProfile with name:', name.trim());
      const response = await updateProfile({ name: name.trim() });
      console.log('[DEBUG PROFILE] updateProfile name response:', JSON.stringify(response));
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

      Alert.alert(
        language === 'ID' ? 'Profil Diperbarui 🎉' : 'Profile Updated 🎉',
        language === 'ID' ? 'Profil berhasil disimpan' : 'Profile saved successfully'
      );
    } catch (err: any) {
      console.log('[DEBUG PROFILE] updateProfile name error:', err);
      Alert.alert(
        language === 'ID' ? 'Update Gagal' : 'Update Failed',
        err.message || (language === 'ID' ? 'Gagal memperbarui profil.' : 'Failed to update profile.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      language === 'ID' ? 'Konfirmasi Logout' : 'Logout Confirmation',
      language === 'ID' ? 'Apakah Anda yakin ingin keluar dari akun?' : 'Are you sure you want to log out?',
      [
        { text: language === 'ID' ? 'Batal' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ID' ? 'Logout' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiLogout().catch(() => null);
            } finally {
              await removeToken();
              router.replace('/');
            }
          },
        },
      ]
    );
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
            {user?.avatar ? (
              <Image 
                source={{ 
                  uri: user.avatar.startsWith('http') 
                     ? `${user.avatar}?t=${Date.now()}` 
                     : `${BASE_URL.replace('/api', '')}${user.avatar}?t=${Date.now()}` 
                  }} 
                  style={styles.userAvatarImg} 
                />
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
            ) : user?.avatar ? (
            <Image 
            source={{ 
              uri: user.avatar.startsWith('http') 
                ? `${user.avatar}?t=${Date.now()}` 
                : `${BASE_URL.replace('/api', '')}${user.avatar}?t=${Date.now()}` 
            }} 
          style={styles.avatarLargeImg} 
            />
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

        <Text style={[styles.userName, { color: colors.text, fontSize: 20 * fontSizeScale }]}>
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