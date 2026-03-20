import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface ImagePickerProps {
  label: string;
  value?: string;
  onChange: (base64: string | undefined) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ label, value, onChange }) => {
  const { colors } = useTheme();
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 1 });

  const MAX_PREVIEW_WIDTH = Dimensions.get('window').width - 64;
  const MAX_PREVIEW_HEIGHT = 280;

  useEffect(() => {
    if (!value) {
      setPreviewSize({ width: 1, height: 1 });
    }
  }, [value]);

  const pickImage = async () => {
    const permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission to access gallery is required!');
      return;
    }

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      onChange(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {value ? (
        <View
          style={[
            styles.imageContainer,
            {
              width: previewSize.width,
              height: previewSize.height,
            },
          ]}
        >
          <Image
            source={{ uri: value }}
            style={[styles.image, { borderColor: colors.border, backgroundColor: colors.surface }]}
            resizeMode="contain"
            onLoad={(event) => {
              const { width, height } = event.nativeEvent.source;
              if (width && height) {
                const scale = Math.min(MAX_PREVIEW_WIDTH / width, MAX_PREVIEW_HEIGHT / height, 1);
                setPreviewSize({
                  width: Math.round(width * scale),
                  height: Math.round(height * scale),
                });
              }
            }}
          />
          <TouchableOpacity
            style={[styles.removeButton, { backgroundColor: colors.danger }]}
            onPress={() => onChange(undefined)}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={pickImage}
        >
          <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.pickerText, { color: colors.textSecondary }]}>Tap to select image</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  picker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerText: {
    marginTop: 8,
    fontSize: 14,
  },
  imageContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  image: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: 10,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
