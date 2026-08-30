import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const palette = {
  light: {
    bg: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#F1F5F9',
    cardBorderDark: '#E2E8F0',
    text: '#0F172A',
    textSub: '#64748B',
    textMuted: '#94A3B8',
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    itemBg: '#F8FAFC',
    primary: '#6C5CE7',
    primarySoft: '#F0EFFF',
    badgePublishedBg: '#ECFDF5',
    badgePublishedText: '#10B981',
    badgeDraftBg: '#FEF3C7',
    badgeDraftText: '#D97706',
    borderTop: '#F1F5F9',
    barTrack: '#F1F5F9',
  },
  dark: {
    bg: '#0F172A',
    cardBg: '#1E293B',
    cardBorder: '#334155',
    cardBorderDark: '#475569',
    text: '#F8FAFC',
    textSub: '#94A3B8',
    textMuted: '#64748B',
    inputBg: '#0F172A',
    inputBorder: '#334155',
    itemBg: '#0F172A',
    primary: '#6C5CE7',
    primarySoft: '#2F2690',
    badgePublishedBg: '#064E3B',
    badgePublishedText: '#34D399',
    badgeDraftBg: '#78350F',
    badgeDraftText: '#FBBF24',
    borderTop: '#334155',
    barTrack: '#334155',
  },
};

type ThemeMode = 'light' | 'dark';
type LanguageType = 'ID' | 'EN';
type FontSizeType = 'Kecil' | 'Sedang' | 'Besar';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: typeof palette.light;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  fontSize: FontSizeType;
  setFontSize: (size: FontSizeType) => void;
  fontSizeScale: number;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  colors: palette.light,
  toggleTheme: () => {},
  setThemeMode: () => {},
  language: 'ID',
  setLanguage: () => {},
  fontSize: 'Sedang',
  setFontSize: () => {},
  fontSizeScale: 1,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [language, setLanguageState] = useState<LanguageType>('ID');
  const [fontSize, setFontSizeState] = useState<FontSizeType>('Sedang');

  useEffect(() => {
    // Load Saved Theme
    SecureStore.getItemAsync('app_theme')
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
        } else if (systemScheme === 'dark') {
          setThemeState('dark');
        }
      })
      .catch(() => {});

    // Load Saved Language
    SecureStore.getItemAsync('app_language')
      .then((savedLang) => {
        if (savedLang === 'ID' || savedLang === 'EN') {
          setLanguageState(savedLang);
        }
      })
      .catch(() => {});

    // Load Saved Font Size
    SecureStore.getItemAsync('app_font_size')
      .then((savedSize) => {
        if (savedSize === 'Kecil' || savedSize === 'Sedang' || savedSize === 'Besar') {
          setFontSizeState(savedSize as FontSizeType);
        }
      })
      .catch(() => {});
  }, [systemScheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeState(mode);
    SecureStore.setItemAsync('app_theme', mode).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeMode(next);
  };

  const setLanguage = (lang: LanguageType) => {
    setLanguageState(lang);
    SecureStore.setItemAsync('app_language', lang).catch(() => {});
  };

  const setFontSize = (size: FontSizeType) => {
    setFontSizeState(size);
    SecureStore.setItemAsync('app_font_size', size).catch(() => {});
  };

  const fontSizeScale = fontSize === 'Kecil' ? 0.85 : fontSize === 'Besar' ? 1.15 : 1;
  const colors = palette[theme];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        colors,
        toggleTheme,
        setThemeMode,
        language,
        setLanguage,
        fontSize,
        setFontSize,
        fontSizeScale,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);