import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

export function ThemeToggleBtn() {
  const { isDark, toggleTheme } = useAppTheme();

  return (
    <TouchableOpacity
      style={[styles.btn, isDark ? styles.btnDark : styles.btnLight]}
      onPress={toggleTheme}
      activeOpacity={0.7}
      accessibilityLabel="Toggle Light/Dark Theme"
    >
      <Ionicons
        name={isDark ? 'sunny-outline' : 'moon-outline'}
        size={18}
        color={isDark ? '#F59E0B' : '#6366F1'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  btnLight: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  btnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
});
