import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '../context/ThemeContext';
import { getMe, getToken, removeToken } from '../services/api_service';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, isDark } = useAppTheme();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const token = await getToken();

        if (!token) {
          router.replace('/');
          return;
        }

        try {
          await getMe();
          router.replace('/(tabs)/home');
        } catch {
          await removeToken();
          router.replace('/');
        }
      } finally {
        if (mounted) {
          setCheckingSession(false);
          await SplashScreen.hideAsync();
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
      {checkingSession && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.bg }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootStack />
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});