import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, LogBox } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '../context/ThemeContext';
import { getMe, getToken, removeToken } from '../services/api_service';
import { AlertProvider } from '../context/AlertContext';

import { processPendingSubmissions } from '../services/offline_sync_service';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'DateTimePicker: `onChange` is deprecated',
  'DateTimePicker: `onChange` is deprecated. Use `onValueChange`',
  'SafeAreaView has been deprecated',
  '"shadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
  'Animated: `useNativeDriver` is not supported',
  'TouchableWithoutFeedback is deprecated',
]);

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, isDark } = useAppTheme();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      try {
        const token = await getToken();
        if (token) {
          const user = await getMe();
          // Cek jika user belum verifikasi OTP, jangan biarkan otomatis masuk
          if (user && user.email_verified_at === null) {
            await removeToken();
          }
        }
      } catch (e) {
        await removeToken();
      } finally {
        if (mounted) {
          setCheckingSession(false);
          await SplashScreen.hideAsync();
        }
      }
    }
    checkAuth();

    // Background auto-sync worker for offline submissions
    processPendingSubmissions().catch(() => {});
    const interval = setInterval(() => {
      processPendingSubmissions().catch(() => {});
    }, 20000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (checkingSession) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Daftarkan rute secara eksplisit di sini */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify_otp" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AlertProvider>
        <RootStack />
      </AlertProvider>
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});