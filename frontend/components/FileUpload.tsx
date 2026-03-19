import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export interface UploadFileValue {
  name: string;
  uri: string;
  mimeType?: string;
}

interface FileUploadProps {
  file: UploadFileValue | null;
  onChange: (file: UploadFileValue | null) => void;
}

export function FileUpload({ file, onChange }: FileUploadProps) {
  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const selected = result.assets[0];
      onChange({
        name: selected.name,
        uri: selected.uri,
        mimeType: selected.mimeType,
      });
    } catch (error) {
      console.error('File pick error:', error);
      Alert.alert('Error', 'Failed to pick file.');
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Upload File</Text>

      <TouchableOpacity style={styles.actionButton} onPress={handlePick} activeOpacity={0.86}>
        <Text style={styles.actionText}>{file ? 'Replace File' : 'Select PDF/DOC'}</Text>
      </TouchableOpacity>

      {file ? (
        <View style={styles.fileMeta}>
          <Text style={styles.fileName}>{file.name}</Text>
          <TouchableOpacity onPress={() => onChange(null)}>
            <Text style={styles.removeText}>Remove file</Text>
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
  actionButton: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  actionText: {
    color: '#D6DEED',
    fontWeight: '600',
    fontSize: 13,
  },
  fileMeta: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242B38',
    backgroundColor: '#151A22',
  },
  fileName: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 6,
  },
  removeText: {
    color: '#FF7A7A',
    fontSize: 13,
    fontWeight: '600',
  },
});

