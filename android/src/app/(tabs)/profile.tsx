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
import { getMe, updateProfile, apiLogout, removeToken } from '../services/api_service';

export default function ProfileScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'C';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Workspace Header */}
      <View style={styles.topWorkspaceRow}>
        <Text style={styles.workspaceText}>{user?.name || 'Creator'}'s workspace</Text>
        <View style={styles.userAvatarBtn}>
          <Text style={styles.userAvatarText}>{initial}</Text>
        </View>
      </View>

      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Update your name and avatar.</Text>
      </View>

      {/* Avatar Card */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User Creator'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'email@quizary.id'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {user?.role ? user.role.toUpperCase() : 'USER'}
          </Text>
        </View>
      </View>

      {/* Profile Form Card */}
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#94A3B8"
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Email</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={user?.email || ''}
          editable={false}
        />
        <Text style={styles.fieldHint}>Email cannot be changed.</Text>

        <TouchableOpacity
          style={[styles.btnSave, saving && styles.btnDisabled]}
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
      <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.btnLogoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', gap: 8 },
  loadingText: { color: '#64748B' },
  topWorkspaceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  workspaceText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  userAvatarBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C7D2FE',
  },
  userAvatarText: { color: '#6366F1', fontWeight: 'bold', fontSize: 14 },
  header: { marginBottom: 20 },
  eyebrow: { color: '#6366F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#0F172A', fontSize: 26, fontWeight: 'bold', marginTop: 2, marginBottom: 2 },
  subtitle: { color: '#64748B', fontSize: 14 },
  avatarCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#6366F1' },
  userName: { color: '#0F172A', fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  userEmail: { color: '#64748B', fontSize: 14, marginBottom: 10 },
  roleBadge: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  roleBadgeText: { color: '#3B82F6', fontSize: 11, fontWeight: 'bold' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1,
  },
  label: { color: '#0F172A', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', color: '#0F172A', padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15,
  },
  disabledInput: { color: '#64748B', backgroundColor: '#F8FAFC' },
  fieldHint: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 16 },
  btnSave: {
    backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', elevation: 1,
  },
  btnDisabled: { opacity: 0.6 },
  btnSaveText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  btnLogout: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FEE2E2',
    paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnLogoutText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
