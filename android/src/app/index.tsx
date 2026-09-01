import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiLogin, saveToken } from '../services/api_service';
import { useAppTheme } from '../context/ThemeContext'; 
import { ThemeToggleBtn } from '../components/ThemeToggleBtn';
import { useAppAlert } from '../context/AlertContext';

export default function LoginScreen() {
  const { colors, isDark } = useAppTheme();
  const { showAlert } = useAppAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert({ type: 'warning', title: 'Lengkapi data', message: 'Email dan password tidak boleh kosong.' });
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
      console.error('[LOGIN ERROR]', e);
      showAlert({ type: 'error', title: 'Login gagal', message: e.message || 'Email atau password salah.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <ThemeToggleBtn />
      </View>
      
      <View style={styles.header}>
        <Image
          source={isDark ? require('../../assets/images/Quizary_Logo_White.png') : require('../../assets/images/Quizary_Logo_Original.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Platform Ujian & Kuis Modern</Text>
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.text }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.cardBorder }]}
          placeholder="email@contoh.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={[styles.label, { color: colors.text }]}>Password</Text>
        <View style={[styles.passwordContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
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
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: colors.primary }, loading && styles.loginBtnDisabled]}
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
          <Text style={[styles.registerText, { color: colors.textSub }]}>Belum punya akun? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={[styles.registerLink, { color: colors.primary }]}>Daftar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
  },
  header: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 220, height: 75, marginBottom: 8 },
  subtitle: { fontSize: 14 },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
  },
  eyeBtn: {
    paddingHorizontal: 14, paddingVertical: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  loginBtn: {
    padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerText: {},
  registerLink: { fontWeight: 'bold' },
});