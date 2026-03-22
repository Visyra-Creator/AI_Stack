import React, { useRef, useState } from 'react';
import {
  Image,
  ImageResizeMode,
  ImageStyle,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DoubleTapImageProps {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}

const DOUBLE_TAP_DELAY_MS = 280;

export const DoubleTapImage: React.FC<DoubleTapImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
}) => {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const lastTapRef = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
      setFullscreenVisible(true);
    }
    lastTapRef.current = now;
  };

  return (
    <>
      <Pressable onPress={handleTap}>
        <Image source={{ uri }} style={style} resizeMode={resizeMode} />
      </Pressable>

      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <Pressable
          style={styles.fullscreenOverlay}
          onPress={() => setFullscreenVisible(false)}
        >
          <View style={styles.closeBadge}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </View>
          <Image
            source={{ uri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  closeBadge: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
  },
});

