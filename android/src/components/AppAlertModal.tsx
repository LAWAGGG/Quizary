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
        return { name: 'checkmark' as const, color: '#10B981', bg: '#ECFDF5', bgDark: 'rgba(16,185,129,0.14)', border: '#A7F3D0', borderDark: 'rgba(16,185,129,0.28)' };
      case 'error':
        return { name: 'alert-circle' as const, color: '#EF4444', bg: '#FEF2F2', bgDark: 'rgba(239,68,68,0.14)', border: '#FECACA', borderDark: 'rgba(239,68,68,0.28)' };
      case 'warning':
        return { name: 'warning' as const, color: '#D97706', bg: '#FFFBEB', bgDark: 'rgba(245,158,11,0.14)', border: '#FDE68A', borderDark: 'rgba(245,158,11,0.28)' };
      case 'confirm':
        return { name: 'help-circle' as const, color: '#6C5CE7', bg: '#F5F3FF', bgDark: 'rgba(108,92,231,0.14)', border: '#DDD6FE', borderDark: 'rgba(108,92,231,0.28)' };
      default:
        return { name: 'information-circle' as const, color: '#475569', bg: '#F8FAFC', bgDark: 'rgba(100,116,139,0.14)', border: '#E2E8F0', borderDark: 'rgba(148,163,184,0.28)' };
    }
  };

  const iconInfo = getIconInfo();
  const accentColor = iconInfo.color;

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
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? '#1E293B' : '#E2E8F0',
            },
          ]}
        >
          {/* Top hairline accent */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

          {/* Header row: icon + title + close */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark ? iconInfo.bgDark : iconInfo.bg,
                  borderColor: isDark ? iconInfo.borderDark : iconInfo.border,
                },
              ]}
            >
              <Ionicons name={iconInfo.name} size={16} color={iconInfo.color} />
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]} />

          {/* Message — left aligned editorial */}
          {message ? (
            <Text style={[styles.message, { color: isDark ? '#94A3B8' : '#475569' }]}>{message}</Text>
          ) : null}

          {/* Actions — right aligned, not full-width purple pill */}
          <View style={styles.actionRow}>
            {type === 'confirm' ? (
              <>
                <TouchableOpacity
                  style={[styles.ghostBtn, { borderColor: isDark ? '#334155' : '#E2E8F0', backgroundColor: isDark ? 'transparent' : '#FFFFFF' }]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.ghostText, { color: isDark ? '#CBD5E1' : '#475569' }]}>{cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                  onPress={handleConfirm}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryText}>{confirmText}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, minWidth: 92 }]}
                onPress={handleConfirm}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryText}>{confirmText}</Text>
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
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  accentBar: {
    height: 2,
    width: '100%',
    opacity: 0.95,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginTop: 12,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ghostBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  primaryBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
