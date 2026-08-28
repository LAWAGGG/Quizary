import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiRegister } from '../services/api_service';
import { useAppTheme } from '../context/ThemeContext';

export default function RegisterScreen() {
  const { language, fontSizeScale } = useAppTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !passwordConfirmation.trim()) {
      Alert.alert(
        language === 'ID' ? 'Lengkapi data' : 'Incomplete Data',
        language === 'ID' ? 'Semua kolom wajib diisi.' : 'All fields are required.'
      );
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert(
        language === 'ID' ? 'Konfirmasi Password Gagal' : 'Password Match Error',
        language === 'ID' ? 'Konfirmasi password tidak cocok dengan password.' : 'Password confirmation does not match.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        language === 'ID' ? 'Password Lemah' : 'Weak Password',
        language === 'ID' ? 'Password minimal terdiri dari 6 karakter.' : 'Password must be at least 6 characters.'
      );
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

      Alert.alert(
        language === 'ID' ? 'Sukses 🎉' : 'Success 🎉',
        language === 'ID' ? 'Registrasi berhasil! Silakan login dengan akun baru Anda.' : 'Registration successful! Please login with your new account.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (e: any) {
      Alert.alert(
        language === 'ID' ? 'Registrasi gagal' : 'Registration Failed',
        e.message || (language === 'ID' ? 'Terjadi kesalahan saat mendaftar.' : 'An error occurred during registration.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: 30 * fontSizeScale }]}>
            {language === 'ID' ? 'Daftar Akun' : 'Register Account'}
          </Text>
          <Text style={[styles.subtitle, { fontSize: 14 * fontSizeScale }]}>
            {language === 'ID' ? 'Formulir dan kuis dengan penilaian otomatis.' : 'Forms and quizzes with automated grading.'}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { fontSize: 13 * fontSizeScale }]}>
            {language === 'ID' ? 'Nama Lengkap' : 'Full Name'}
          </Text>
          <TextInput
            style={[styles.input, { fontSize: 15 * fontSizeScale }]}
            placeholder={language === 'ID' ? 'Nama Anda' : 'Your Name'}
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { fontSize: 13 * fontSizeScale }]}>
            {language === 'ID' ? 'Email' : 'Email Address'}
          </Text>
          <TextInput
            style={[styles.input, { fontSize: 15 * fontSizeScale }]}
            placeholder="email@contoh.com"
            placeholderTextColor="#475569"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { fontSize: 13 * fontSizeScale }]}>
            {language === 'ID' ? 'Password' : 'Password'}
          </Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { fontSize: 15 * fontSizeScale }]}
              placeholder="••••••••"
              placeholderTextColor="#475569"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20 * fontSizeScale}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { fontSize: 13 * fontSizeScale }]}>
            {language === 'ID' ? 'Konfirmasi Password' : 'Confirm Password'}
          </Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { fontSize: 15 * fontSizeScale }]}
              placeholder="••••••••"
              placeholderTextColor="#475569"
              secureTextEntry={!showPasswordConfirmation}
              value={passwordConfirmation}
              onChangeText={setPasswordConfirmation}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPasswordConfirmation ? 'eye-off-outline' : 'eye-outline'}
                size={20 * fontSizeScale}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={[styles.registerBtnText, { fontSize: 15 * fontSizeScale }]}>
                {language === 'ID' ? 'Daftar Sekarang' : 'Register Now'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { fontSize: 14 * fontSizeScale }]}>
              {language === 'ID' ? 'Sudah punya akun? ' : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/')}>
              <Text style={[styles.loginLink, { fontSize: 14 * fontSizeScale }]}>
                {language === 'ID' ? 'Login' : 'Sign In'}
              </Text>
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
  title: { color: '#FFF', fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94A3B8' },
  form: { gap: 8 },
  label: { color: '#CBD5E1', fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#1E293B', color: '#FFF', padding: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#334155',
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  passwordInput: {
    flex: 1, color: '#FFF', padding: 14,
  },
  eyeBtn: {
    paddingHorizontal: 14, paddingVertical: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  registerBtn: {
    backgroundColor: '#6C5CE7', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 16,
  },
  registerBtnDisabled: { opacity: 0.6 },
  registerBtnText: { color: '#FFF', fontWeight: 'bold' },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { color: '#64748B' },
  loginLink: { color: '#6C5CE7', fontWeight: 'bold' },
});