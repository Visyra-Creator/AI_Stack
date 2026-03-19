import React, { useMemo } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

export default function FileViewerScreen() {
  const { uri, name, mimeType } = useLocalSearchParams<{ uri: string; name: string; mimeType?: string }>();

  const safeUri = useMemo(() => decodeURIComponent(uri ?? ''), [uri]);
  const safeName = useMemo(() => decodeURIComponent(name ?? ''), [name]);
  const safeMimeType = useMemo(() => decodeURIComponent(mimeType ?? ''), [mimeType]);
  const isLocalFile = safeUri.startsWith('file://');
  const useExternalOnly = Platform.OS === 'android' && isLocalFile;
  const isExpoGo = Constants.appOwnership === 'expo';
  const isPdf =
    safeMimeType.toLowerCase().includes('pdf') ||
    safeUri.toLowerCase().endsWith('.pdf') ||
    safeName.toLowerCase().endsWith('.pdf');

  let NativePdfView: any = null;
  if (!isExpoGo) {
    try {
      NativePdfView = require('react-native-pdf').default;
    } catch {
      NativePdfView = null;
    }
  }

  if (!safeUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>No document selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.metaBar}>
        <Text style={styles.fileName} numberOfLines={1}>{safeName || 'Document'}</Text>
        <TouchableOpacity
          style={styles.openExternalButton}
          onPress={() => Linking.openURL(safeUri)}
          activeOpacity={0.85}
        >
          <Text style={styles.openExternalText}>Open Externally</Text>
        </TouchableOpacity>
      </View>

      {isPdf && NativePdfView && !useExternalOnly ? (
        <NativePdfView
          source={{ uri: safeUri, cache: true }}
          style={styles.viewer}
          trustAllCerts={false}
          enablePaging
        />
      ) : useExternalOnly ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>This local file cannot be previewed inside Expo Go on Android.</Text>
          <Text style={styles.errorHint}>Use Open Externally to view the document.</Text>
        </View>
      ) : isPdf && isExpoGo ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>In-app PDF preview requires a development build.</Text>
          <Text style={styles.errorHint}>For Expo Go, use Open Externally.</Text>
        </View>
      ) : (
        <WebView source={{ uri: safeUri }} style={styles.viewer} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#9BA5B8',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 6,
  },
  errorHint: {
    color: '#7D8698',
    fontSize: 12,
    textAlign: 'center',
    marginHorizontal: 24,
  },
  metaBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#242B38',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fileName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  openExternalButton: {
    borderWidth: 1,
    borderColor: '#2A3241',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#151A22',
  },
  openExternalText: {
    color: '#D6DEED',
    fontSize: 11,
    fontWeight: '600',
  },
  viewer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
});

