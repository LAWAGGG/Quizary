import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '../context/ThemeContext';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { isDark } = useAppTheme();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide the splash screen after the layout has mounted
    SplashScreen.hideAsync();
  }, []);

  return (
    <AppThemeProvider>
      <RootStack />
    </AppThemeProvider>
  );
}
