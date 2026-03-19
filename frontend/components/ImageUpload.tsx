import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ImageUploadProps {
  imageUri: string;
  onChange: (uri: string) => void;
}

export function ImageUpload({ imageUri, onChange }: ImageUploadProps) {
  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onChange(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Upload Image</Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.actionButton} onPress={pickFromLibrary} activeOpacity={0.86}>
          <Text style={styles.actionText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto} activeOpacity={0.86}>
          <Text style={styles.actionText}>Camera</Text>
        </TouchableOpacity>
      </View>

      {imageUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          <TouchableOpacity onPress={() => onChange('')}>
            <Text style={styles.removeText}>Remove image</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  label: {
    color: '#95A0B3',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: {
    color: '#D6DEED',
    fontWeight: '600',
    fontSize: 13,
  },
  previewWrap: {
    marginTop: 12,
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: '#0E1219',
    borderWidth: 1,
    borderColor: '#242B38',
    marginBottom: 8,
  },
  removeText: {
    color: '#FF7A7A',
    fontSize: 13,
    fontWeight: '600',
  },
});

