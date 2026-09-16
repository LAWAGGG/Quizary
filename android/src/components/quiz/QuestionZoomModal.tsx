import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { QuizQuestionCard } from './QuizQuestionCard';
import { PinchZoomContainer } from '../PinchZoomContainer';

interface QuestionZoomModalProps {
  visible: boolean;
  question: any;
  index: number;
  userAnswer: any;
  isFileUploading: boolean;
  themeColor?: string;
  onClose: () => void;
  onSelectOption: (qId: number, optId: number, isCheckbox: boolean) => void;
  onTextChange: (qId: number, text: string) => void;
  onPickFile: (qId: number) => void;
}

export function QuestionZoomModal({
  visible,
  question,
  index,
  userAnswer,
  isFileUploading,
  themeColor,
  onClose,
  onSelectOption,
  onTextChange,
  onPickFile,
}: QuestionZoomModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0);

  if (!question) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              {/* Header bar inside Zoom Modal */}
              <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.inputBorder, paddingTop: topPadding + 6 }]}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Zoom Soal #{index + 1}</Text>
                <View style={{ width: 40 }} />
              </View>

              <Text style={[styles.zoomTipText, { color: colors.textSub }]}>
                Gunakan tombol + / - untuk zoom, lalu geser dengan 1 jari
              </Text>

              {/* Pinch Zoom Container for this single question card */}
              <PinchZoomContainer>
                <View style={{ width: '100%' }}>
                  <QuizQuestionCard
                    question={question}
                    index={index}
                    userAnswer={userAnswer}
                    isFileUploading={isFileUploading}
                    themeColor={themeColor}
                    onSelectOption={onSelectOption}
                    onTextChange={onTextChange}
                    onPickFile={onPickFile}
                  />
                </View>
              </PinchZoomContainer>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  zoomTipText: {
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
});
