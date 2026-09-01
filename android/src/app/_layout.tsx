import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, LogBox } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '../context/ThemeContext';
import { getMe, getToken, removeToken } from '../services/api_service';
import { AlertProvider } from '../context/AlertContext';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'DateTimePicker: `onChange` is deprecated',
  'DateTimePicker: `onChange` is deprecated. Use `onValueChange`',
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
          await getMe();
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
    return () => {
      mounted = false;
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
      <Stack screenOptions={{ headerShown: false }} />
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