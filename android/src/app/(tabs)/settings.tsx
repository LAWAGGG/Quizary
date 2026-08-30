import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';

export default function SettingsScreen() {
  const { colors, isDark, language, setLanguage, fontSize, setFontSize, fontSizeScale } = useAppTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary, fontSize: 11 * fontSizeScale }]}>
          {language === 'ID' ? 'PENGATURAN' : 'SETTINGS'}
        </Text>
        <Text style={[styles.title, { color: colors.text, fontSize: 26 * fontSizeScale }]}>
          {language === 'ID' ? 'Pengaturan Aplikasi' : 'App Settings'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSub, fontSize: 14 * fontSizeScale }]}>
          {language === 'ID' ? 'Sesuaikan tampilan dan kenyamanan aplikasi Anda.' : 'Customize your app appearance and preferences.'}
        </Text>
      </View>

      {/* Card Mode Tampilan (Dark/Light) */}
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <View style={styles.settingRow}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.text, fontSize: 14 * fontSizeScale }]}>
              {language === 'ID' ? 'Mode Tampilan' : 'Display Mode'}
            </Text>
            <Text style={[styles.settingSublabel, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
              {language === 'ID' 
                ? (isDark ? 'Saat ini: Dark Mode' : 'Saat ini: Light Mode')
                : (isDark ? 'Current: Dark Mode' : 'Current: Light Mode')}
            </Text>
          </View>
          <ThemeToggleBtn />
        </View>
      </View>

      {/* Card Bahasa & Ukuran Teks */}
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        {/* Bahasa */}
        <View style={styles.settingRow}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.text, fontSize: 14 * fontSizeScale }]}>
              {language === 'ID' ? 'Bahasa' : 'Language'}
            </Text>
            <Text style={[styles.settingSublabel, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
              {language === 'ID' ? 'Pilih bahasa tampilan' : 'Select display language'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.langBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            onPress={() => setLanguage(language === 'ID' ? 'EN' : 'ID')}
            activeOpacity={0.8}
          >
            <Text style={[styles.langBtnText, { color: colors.primary, fontSize: 13 * fontSizeScale }]}>
              {language === 'ID' ? '🇮🇩 Indonesia' : '🇺🇸 English'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />

        {/* Ukuran Teks */}
        <View style={styles.settingColumn}>
          <Text style={[styles.settingLabel, { color: colors.text, fontSize: 14 * fontSizeScale }]}>
            {language === 'ID' ? 'Ukuran Teks' : 'Font Size'}
          </Text>
          <Text style={[styles.settingSublabel, { color: colors.textSub, fontSize: 12 * fontSizeScale }]}>
            {language === 'ID' ? 'Sesuaikan kenyamanan membaca' : 'Adjust reading comfort'}
          </Text>

          <View style={styles.chipGroup}>
            {(['Kecil', 'Sedang', 'Besar'] as const).map((size) => {
              let label = size as string;
              if (language === 'EN') {
                if (size === 'Kecil') label = 'Small';
                if (size === 'Sedang') label = 'Medium';
                if (size === 'Besar') label = 'Large';
              }

              return (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                    fontSize === size && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setFontSize(size)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSub, fontSize: 13 * fontSizeScale },
                      fontSize === size && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  header: { marginBottom: 20 },
  eyebrow: { fontWeight: '800', letterSpacing: 1.2 },
  title: { fontWeight: 'bold', marginTop: 2, marginBottom: 2 },
  subtitle: {},
  card: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, elevation: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingColumn: { marginTop: 2 },
  settingLabel: { fontWeight: '600' },
  settingSublabel: { marginTop: 2 },
  langBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  langBtnText: { fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 14 },
  chipGroup: { flexDirection: 'row', gap: 10, marginTop: 10 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  chipText: { fontWeight: '600' },
});