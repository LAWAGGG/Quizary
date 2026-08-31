import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertConfig {
  visible: boolean;
  type?: AlertType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AppAlertModalProps {
  config: AlertConfig;
  onClose: () => void;
}

export function AppAlertModal({ config, onClose }: AppAlertModalProps) {
  const { colors, isDark } = useAppTheme();
  const { visible, type = 'info', title, message, confirmText = 'OK', cancelText = 'Batal', onConfirm, onCancel } = config;

  if (!visible) return null;

  const getIconInfo = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'error':
        return { name: 'close-circle' as const, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'warning':
        return { name: 'warning' as const, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'confirm':
        return { name: 'help-circle' as const, color: '#6C5CE7', bg: 'rgba(108, 92, 231, 0.15)', border: 'rgba(108, 92, 231, 0.3)' };
      default:
        return { name: 'information-circle' as const, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)' };
    }
  };

  const iconInfo = getIconInfo();

  const handleConfirm = () => {
    onClose();
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    onClose();
    if (onCancel) onCancel();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContainer,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          }
        ]}>
          {/* Glowing Header Badge Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: iconInfo.bg, borderColor: iconInfo.border }]}>
            <Ionicons name={iconInfo.name} size={38} color={iconInfo.color} />
          </View>

          {/* Title & Message */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {message}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {type === 'confirm' ? (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn, { borderColor: isDark ? '#334155' : '#CBD5E1' }]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn, { backgroundColor: '#6C5CE7' }]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>{confirmText}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.singleBtn, { backgroundColor: '#6C5CE7' }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleBtn: {
    width: '100%',
  },
  cancelBtn: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  confirmBtn: {
    elevation: 4,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
