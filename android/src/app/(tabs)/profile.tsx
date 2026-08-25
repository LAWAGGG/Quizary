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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMe, updateProfile, apiLogout, removeToken } from '../../services/api_service';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { useAppTheme } from '../../context/ThemeContext';

export default function ProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const data = await getMe();
      if (data) {
        setUser(data);
        setName(data.name || '');
      }
    } catch (err: any) {
      console.log('Failed to fetch user profile:', err);
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim() });
      setUser(updated);
      Alert.alert('Profile Updated 🎉', 'Your profile has been updated successfully!');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
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
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSub }]}>Loading profile...</Text>
      </View>
    );
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'C';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Workspace Header */}
      <View style={styles.topWorkspaceRow}>
        <Text style={[styles.workspaceText, { color: colors.textSub }]}>{user?.name || 'Respondent'}'s profile</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemeToggleBtn />
          <View style={[styles.userAvatarBtn, { backgroundColor: colors.primarySoft, borderColor: isDark ? colors.cardBorder : '#C7D2FE' }]}>
            <Text style={[styles.userAvatarText, { color: colors.primary }]}>{initial}</Text>
          </View>
        </View>
      </View>

      {/* Page Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>ACCOUNT</Text>
        <Text style={[styles.title, { color: colors.text }]}>My Profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Update your name and avatar.</Text>
      </View>

      {/* Avatar Card */}
      <View style={[styles.avatarCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primarySoft, borderColor: isDark ? colors.cardBorder : '#FFFFFF' }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'User Creator'}</Text>
        <Text style={[styles.userEmail, { color: colors.textSub }]}>{user?.email || 'email@quizary.id'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF', borderColor: isDark ? '#3B82F6' : '#BFDBFE' }]}>
          <Text style={[styles.roleBadgeText, { color: '#3B82F6' }]}>
            {user?.role ? user.role.toUpperCase() : 'USER'}
          </Text>
        </View>
      </View>

      {/* Profile Form Card */}
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>Email</Text>
        <TextInput
          style={[styles.input, styles.disabledInput, { backgroundColor: colors.itemBg, color: colors.textSub, borderColor: colors.inputBorder }]}
          value={user?.email || ''}
          editable={false}
        />
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>Email cannot be changed.</Text>

        <TouchableOpacity
          style={[styles.btnSave, { backgroundColor: colors.primary }, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnSaveText}>Save Changes</Text>
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
        <Text style={[styles.btnLogoutText, { color: isDark ? '#FCA5A5' : '#EF4444' }]}>Logout</Text>
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
  workspaceText: { fontSize: 13, fontWeight: '600' },
  userAvatarBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  userAvatarText: { fontWeight: 'bold', fontSize: 14 },
  header: { marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: 'bold', marginTop: 2, marginBottom: 2 },
  subtitle: { fontSize: 14 },
  avatarCard: {
    borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 16, borderWidth: 1, elevation: 1,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 3, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  userName: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  userEmail: { fontSize: 14, marginBottom: 10 },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: 'bold' },
  card: {
    borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, elevation: 1,
  },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    padding: 14, borderRadius: 10, borderWidth: 1, fontSize: 15,
  },
  disabledInput: {},
  fieldHint: { fontSize: 12, marginTop: 4, marginBottom: 16 },
  btnSave: {
    paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', elevation: 1,
  },
  btnDisabled: { opacity: 0.6 },
  btnSaveText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  btnLogout: {
    borderWidth: 1, paddingVertical: 14, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnLogoutText: { fontWeight: '600', fontSize: 15 },
});
