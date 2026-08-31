import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
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

  if (!question) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              {/* Header bar inside Zoom Modal */}
              <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.inputBorder }]}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
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
