import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface ImagePickerProps {
  label: string;
  value?: string;
  values?: string[];
  multiple?: boolean;
  maxSelection?: number;
  onChange: (base64: string | undefined) => void;
  onChangeValues?: (base64List: string[]) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  label,
  value,
  values,
  multiple = false,
  maxSelection = 10,
  onChange,
  onChangeValues,
}) => {
  const { colors } = useTheme();
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 1 });

  const MAX_PREVIEW_WIDTH = Dimensions.get('window').width - 64;
  const MAX_PREVIEW_HEIGHT = 280;

  useEffect(() => {
    if (!value && !multiple) {
      setPreviewSize({ width: 1, height: 1 });
    }
  }, [value, multiple]);

  const currentValues = multiple ? (values || []) : value ? [value] : [];
  const isUnlimitedSelection = multiple && maxSelection <= 0;

  const persistPickedImage = async (assetUri: string): Promise<string> => {
    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) return assetUri;

      // Keep already-persisted files untouched.
      if (assetUri.startsWith(documentDir)) return assetUri;

      const match = assetUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const ext = (match?.[1] || 'jpg').toLowerCase();
      const folder = `${documentDir}aikeeper-images`;
      const destination = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      await FileSystem.copyAsync({ from: assetUri, to: destination });
      return destination;
    } catch {
      return assetUri;
    }
  };

  const pickImage = async () => {
    const permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission to access gallery is required!');
      return;
    }

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: !multiple,
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? (isUnlimitedSelection ? 0 : maxSelection) : 1,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const picked = (await Promise.all(
        result.assets
          .map((asset) => asset.uri)
          .filter((uri): uri is string => !!uri)
          .map((uri) => persistPickedImage(uri)),
      )).filter((item): item is string => !!item);

      if (picked.length === 0) return;

      if (multiple) {
        const merged = isUnlimitedSelection
          ? [...currentValues, ...picked]
          : [...currentValues, ...picked].slice(0, maxSelection);
        onChangeValues?.(merged);
      } else {
        onChange(picked[0]);
      }
    }
  };

  const removeImageAt = (index: number) => {
    if (!multiple) {
      onChange(undefined);
      return;
    }
    const next = currentValues.filter((_, i) => i !== index);
    onChangeValues?.(next);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {currentValues.length > 0 ? (
        multiple ? (
          <View style={styles.multiGrid}>
            {currentValues.map((img, index) => (
              <View key={`${img.slice(0, 24)}-${index}`} style={styles.multiImageContainer}>
                <Image
                  source={{ uri: img }}
                  style={[styles.multiImage, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: colors.danger }]}
                  onPress={() => removeImageAt(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {(isUnlimitedSelection || currentValues.length < maxSelection) && (
              <TouchableOpacity
                style={[styles.addMoreTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                <Ionicons name="add" size={24} color={colors.textSecondary} />
                <Text style={[styles.addMoreText, { color: colors.textSecondary }]}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
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
              source={{ uri: currentValues[0] }}
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
              onPress={() => removeImageAt(0)}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )
      ) : (
        <TouchableOpacity
          style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={pickImage}
        >
          <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.pickerText, { color: colors.textSecondary }]}>Tap to select {multiple ? 'images' : 'image'}</Text>
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
  multiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  multiImageContainer: {
    width: 92,
    height: 92,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  multiImage: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: 10,
  },
  addMoreTile: {
    width: 92,
    height: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
});
