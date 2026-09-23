import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiForgotPassword, apiResetPassword } from '../services/api_service';
import { useAppAlert } from '../context/AlertContext';
import { palette, useAppTheme } from '../context/ThemeContext';

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

export default function ForgotPasswordScreen() {
  const colors = palette.light;
  const isDark = false;
  const { showAlert } = useAppAlert();
  const { fontSizeScale } = useAppTheme();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const digitInputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: Minta kode OTP ke Email
  const handleRequestCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert({
        type: 'warning',
        title: 'Email Kosong',
        message: 'Masukkan alamat email akun Anda.',
      });
      return;
    }

    setLoading(true);
    try {
      await apiForgotPassword({ email: trimmedEmail });
      showAlert({
        type: 'success',
        title: 'Kode Terkirim',
        message: `Kode reset password telah dikirim ke ${trimmedEmail}. Silakan cek inbox/spam email Anda.`,
      });
      setStep(2);
      startCooldown();
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: 'Gagal',
        message: err.message || 'Gagal mengirim kode reset password.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Kirim Ulang OTP di Step 2
  const handleResendCode = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await apiForgotPassword({ email: email.trim() });
      showAlert({
        type: 'success',
        title: 'Kode Terkirim',
        message: 'Kode OTP baru telah dikirim ke email Anda.',
      });
      startCooldown();
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: 'Gagal Kirim Ulang',
        message: err.message || 'Gagal mengirim ulang kode reset.',
      });
    } finally {
      setResending(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async () => {
    if (!otp || otp.length < OTP_LENGTH) {
      showAlert({
        type: 'warning',
        title: 'Kode OTP',
        message: 'Masukkan 6 digit kode OTP dari email Anda.',
      });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      showAlert({
        type: 'warning',
        title: 'Password Lemah',
        message: 'Password baru minimal 8 karakter.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({
        type: 'warning',
        title: 'Password Tidak Cocok',
        message: 'Konfirmasi password tidak cocok dengan password baru.',
      });
      return;
    }

    setLoading(true);
    try {
      await apiResetPassword({
        email: email.trim(),
        code: otp,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      showAlert({
        type: 'success',
        title: 'Berhasil',
        message: 'Password berhasil diubah. Silakan masuk menggunakan password baru Anda.',
        onConfirm: () => router.replace('/'),
      });
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: 'Reset Gagal',
        message: err.message || 'Gagal mereset password. Pastikan kode OTP benar.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Digits OTP Input Handlers
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] || '');

  const handleDigitChange = (text: string, index: number) => {
    if (text.length > 1) {
      const clean = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
      setOtp(clean);
      const nextIdx = Math.min(clean.length, OTP_LENGTH - 1);
      digitInputRefs.current[nextIdx]?.focus();
      return;
    }

    const cleanChar = text.replace(/[^0-9]/g, '');
    const currentDigits = [...digits];
    currentDigits[index] = cleanChar;
    const newOtp = currentDigits.join('');
    setOtp(newOtp);

    if (cleanChar && index < OTP_LENGTH - 1) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header Back Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (step === 2 ? setStep(1) : router.back())}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.logoBox}>
            <Image
              source={
                isDark
                  ? require('../../assets/images/Quizary_Logo_White.png')
                  : require('../../assets/images/Quizary_Logo_Original.png')
              }
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text, fontSize: 22 * fontSizeScale }]}>
              {step === 1 ? 'Lupa Password?' : 'Reset Password'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>
              {step === 1
                ? 'Masukkan email akun Anda untuk menerima kode OTP reset password.'
                : `Masukkan kode OTP 6 digit yang dikirim ke ${email}.`}
            </Text>
          </View>

          {step === 1 ? (
            /* STEP 1: REQUEST OTP */
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.text, fontSize: 13 * fontSizeScale }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.cardBg,
                    color: colors.text,
                    borderColor: colors.cardBorder,
                    fontSize: 15 * fontSizeScale,
                  },
                ]}
                placeholder="email@contoh.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="done"
                onSubmitEditing={handleRequestCode}
              />

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  loading && styles.btnDisabled,
                ]}
                onPress={handleRequestCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.actionBtnText, { fontSize: 15 * fontSizeScale }]}>
                    Kirim Kode OTP
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* STEP 2: VERIFY OTP & NEW PASSWORD */
            <View style={styles.form}>
              {/* OTP Digits */}
              <Text style={[styles.label, { color: colors.text, fontSize: 13 * fontSizeScale }]}>Kode OTP (6 Digit)</Text>
              <View style={styles.otpRow}>
                {digits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => { digitInputRefs.current[idx] = el; }}
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: colors.cardBg,
                        color: colors.text,
                        borderColor: digit ? colors.primary : colors.cardBorder,
                        fontSize: 20 * fontSizeScale,
                      },
                    ]}
                    keyboardType="number-pad"
                    maxLength={idx === 0 ? OTP_LENGTH : 1}
                    value={digit}
                    onChangeText={(text) => handleDigitChange(text, idx)}
                    onKeyPress={(e) => handleKeyPress(e, idx)}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {/* Password Baru */}
              <Text style={[styles.label, { color: colors.text, fontSize: 13 * fontSizeScale, marginTop: 12 }]}>
                Password Baru
              </Text>
              <View style={[styles.passwordContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, fontSize: 15 * fontSizeScale }]}
                  placeholder="Minimal 8 karakter"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Konfirmasi Password */}
              <Text style={[styles.label, { color: colors.text, fontSize: 13 * fontSizeScale, marginTop: 8 }]}>
                Konfirmasi Password Baru
              </Text>
              <View style={[styles.passwordContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, fontSize: 15 * fontSizeScale }]}
                  placeholder="Ulangi password baru"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onSubmitEditing={handleResetPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Resend OTP option */}
              <View style={styles.resendRow}>
                <Text style={[styles.resendText, { color: colors.textSub, fontSize: 13 * fontSizeScale }]}>
                  Tidak menerima kode?{' '}
                </Text>
                <TouchableOpacity onPress={handleResendCode} disabled={cooldown > 0 || resending}>
                  <Text
                    style={[
                      styles.resendLink,
                      { color: cooldown > 0 || resending ? colors.textMuted : colors.primary, fontSize: 13 * fontSizeScale },
                    ]}
                  >
                    {resending
                      ? 'Mengirim...'
                      : cooldown > 0
                      ? `Kirim Ulang (${cooldown}s)`
                      : 'Kirim Ulang'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  loading && styles.btnDisabled,
                ]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.actionBtnText, { fontSize: 15 * fontSizeScale }]}>
                    Simpan Password Baru
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  logoBox: { alignItems: 'center', marginBottom: 28 },
  logoImage: { width: 180, height: 60, marginBottom: 12 },
  title: { fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 20 },
  form: { gap: 6 },
  label: { fontWeight: '600', marginTop: 4 },
  input: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    textAlign: 'center',
    fontWeight: 'bold',
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
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
  },
  resendText: {},
  resendLink: { fontWeight: 'bold' },
  actionBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#FFF', fontWeight: 'bold' },
});
