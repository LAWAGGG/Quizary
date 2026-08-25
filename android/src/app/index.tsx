import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { apiLogin, saveToken } from '../services/api_service';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Lengkapi data', 'Email dan password tidak boleh kosong.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiLogin({ email: email.trim(), password });
      
      if (data.token || data.access_token) {
        await saveToken(data.token || data.access_token);
      }
      
      router.replace('/(tabs)/home');
    } catch (e: any) {
      Alert.alert('Login gagal', e.message || 'Email atau password salah / server tidak dapat dijangkau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>Q</Text>
        </View>
        <Text style={styles.title}>Quizary</Text>
        <Text style={styles.subtitle}>Platform Ujian & Kuis Modern</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="email@contoh.com"
          placeholderTextColor="#475569"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#475569"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.loginBtnText}>Masuk ke Akun</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Belum punya akun? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}>Daftar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 36 },
  logoBox: {
    width: 86, height: 86, borderRadius: 22,
    backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8,
  },
  logoText: { fontSize: 44, fontWeight: 'bold', color: '#FFF' },
  title: { color: '#FFF', fontSize: 30, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94A3B8', fontSize: 14 },
  form: { gap: 8 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#1E293B', color: '#FFF', padding: 14,
    borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#334155',
  },
  loginBtn: {
    backgroundColor: '#3B82F6', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: '#1E293B' },
  orText: { color: '#64748B', fontSize: 13 },
  guestBtn: {
    borderWidth: 2, borderColor: '#3B82F6', padding: 14,
    borderRadius: 12, alignItems: 'center',
  },
  guestBtnText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 15 },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerText: { color: '#64748B' },
  registerLink: { color: '#10B981', fontWeight: 'bold' },
});
