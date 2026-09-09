import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { verifyOtpApi, resendOtpApi } from '../services/api_service';
import { useAppAlert } from '../context/AlertContext';
import { useAppTheme } from '../context/ThemeContext';

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  
  // ── STATE & LOGIC ───────────────────────────────────────────────────
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { showAlert } = useAppAlert();
  const { fontSizeScale, isDark } = useAppTheme();
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleVerify = async () => {
    if (!otp || otp.length < 4) {
      showAlert({
        type: 'warning',
        title: 'Error',
        message: 'Masukkan kode OTP dengan benar.',
      });
      return;
    }

    setLoading(true);
    try {
      await verifyOtpApi({
        email: email || '',
        code: otp,
      });

      router.replace('/(tabs)/home');
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Gagal Verifikasi',
        message: error.message || 'Kode OTP salah atau kadaluarsa',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await resendOtpApi({ email: email || '' });
      showAlert({
        type: 'success',
        title: 'Kode Terkirim',
        message: 'Kode OTP baru telah dikirim ke email kamu.',
      });
      startCooldown();
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Gagal Kirim Ulang',
        message: error.message || 'Gagal mengirim ulang kode OTP.',
      });
    } finally {
      setResending(false);
    }
  };

  // ── INPUT OTP LOGIC ──────────────────────────────────────────────────
  const digitInputRefs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] || '');

  const handleDigitChange = (text: string, index: number) => {
    if (text.length > 1) {
      const pasted = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
      setOtp(pasted);
      const nextIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      digitInputRefs.current[nextIdx]?.focus();
      return;
    }

    const cleaned = text.replace(/[^0-9]/g, '');
    const nextChars = otp.split('');
    nextChars[index] = cleaned;
    const nextOtp = nextChars.join('').slice(0, OTP_LENGTH);
    setOtp(nextOtp);

    if (cleaned && index < OTP_LENGTH - 1) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
      const nextChars = otp.split('');
      nextChars[index - 1] = '';
      setOtp(nextChars.join(''));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Brand header */}
      <View style={styles.brandRow}>
        <Image 
          source={
            isDark 
              ? require('../../assets/images/Quizary_Logo_White.png') 
              : require('../../assets/images/Quizary_Logo_White.png') // Menggunakan logo default agar tidak error bundler Metro
          } 
          style={styles.brandLogo} 
          resizeMode="contain" 
        />
        <Text style={styles.brandText}>Quizary</Text>
      </View>

      <Text style={[styles.title, { fontSize: 26 * fontSizeScale }]}>Verifikasi Email</Text>
      <Text style={[styles.subtitle, { fontSize: 14 * fontSizeScale }]}>
        Kami mengirim kode 6 digit ke <Text style={styles.subtitleEmail}>{email || ''}</Text>
      </Text>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Email</Text>
        <View style={styles.emailFieldBox}>
          <Ionicons name="mail-outline" size={18} color="#64748B" />
          <Text style={styles.emailFieldText} numberOfLines={1}>
            {email || ''}
          </Text>
        </View>

        <View style={styles.codeLabelRow}>
          <Text style={styles.fieldLabel}>Kode Verifikasi</Text>
          <Text style={styles.codeCounterText}>
            {otp.length}/{OTP_LENGTH}
          </Text>
        </View>

        <View style={styles.otpBoxesRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                digitInputRefs.current[i] = ref;
              }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(text) => handleDigitChange(text, i)}
              onKeyPress={(e) => handleDigitKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={i === 0 ? OTP_LENGTH : 1}
              textAlign="center"
              placeholderTextColor="#475569"
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>Verifikasi & Lanjutkan</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerMutedText}>Belum dapat kode?</Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {resending ? (
              <ActivityIndicator color="#7263E8" size="small" />
            ) : (
              <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
                {cooldown > 0 ? `Kirim ulang kode (${cooldown}s)` : 'Kirim ulang kode'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#0B1220',
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  brandLogo: {
    width: 36,
    height: 36,
  },
  brandText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
  },

  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 28,
  },
  subtitleEmail: {
    color: '#E2E8F0',
    fontWeight: '600',
  },

  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    padding: 20,
  },

  fieldLabel: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
  },

  emailFieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  emailFieldText: {
    color: '#94A3B8',
    fontSize: 14,
    flex: 1,
  },

  codeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  codeCounterText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },

  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  otpBox: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  otpBoxFilled: {
    borderColor: '#7263E8',
  },

  verifyButton: {
    backgroundColor: '#7263E8',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  footerMutedText: {
    color: '#64748B',
    fontSize: 13,
  },
  resendText: {
    color: '#7263E8',
    fontWeight: '700',
    fontSize: 13,
  },
  resendTextDisabled: {
    color: '#475569',
  },
});