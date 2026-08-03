import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { apiRegister } from './services/api_service';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !passwordConfirmation.trim()) {
      Alert.alert('Lengkapi data', 'Semua kolom wajib diisi.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Konfirmasi Password Gagal', 'Konfirmasi password tidak cocok dengan password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Password Lemah', 'Password minimal terdiri dari 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      await apiRegister({ 
        name: name.trim(), 
        email: email.trim(), 
        password,
        password_confirmation: passwordConfirmation
      });
      
      Alert.alert('Sukses 🎉', 'Registrasi berhasil! Silakan login dengan akun baru Anda.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } catch (e: any) {
      Alert.alert('Registrasi gagal', e.message || 'Terjadi kesalahan saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Daftar Akun</Text>
          <Text style={styles.subtitle}>Bergabung sebagai Creator Quizary</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput
            style={styles.input}
            placeholder="Nama Anda"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />

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

          <Text style={styles.label}>Konfirmasi Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#475569"
            secureTextEntry
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
          />

          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.registerBtnText}>Daftar Sekarang</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.replace('/')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#0F172A', justifyContent: 'center' },
  container: { padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { color: '#FFF', fontSize: 30, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94A3B8', fontSize: 14 },
  form: { gap: 8 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#1E293B', color: '#FFF', padding: 14,
    borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#334155',
  },
  registerBtn: {
    backgroundColor: '#10B981', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 16,
  },
  registerBtnDisabled: { opacity: 0.6 },
  registerBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { color: '#64748B' },
  loginLink: { color: '#3B82F6', fontWeight: 'bold' },
});
