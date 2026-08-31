import React from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, Text, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageZoomModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

export function ImageZoomModal({ visible, imageUri, onClose }: ImageZoomModalProps) {
  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top bar with close button */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Zoomable Image Container */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom={true}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172AEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hintText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.8,
  },
});
