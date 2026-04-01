import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import { isPdfUri, isRemoteUri, normalizeFileUri, openUriExternally } from '@/src/services/fileOpener';

interface PDFViewerProps {
  visible: boolean;
  uri: string;
  fileName: string;
  onClose: () => void;
  colors: any;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ visible, uri, fileName, onClose, colors }) => {
  const { width, height } = useWindowDimensions();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [PdfComponent, setPdfComponent] = useState<any>(null);
  const [pdfSupported, setPdfSupported] = useState(false);
  const [webFallbackError, setWebFallbackError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPdfModule = async () => {
      // Expo Go does not include the native module needed by react-native-pdf.
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo || Platform.OS === 'web') {
        if (mounted) {
          setPdfSupported(false);
          setPdfComponent(null);
        }
        return;
      }

      try {
        const module = await import('react-native-pdf');
        if (mounted) {
          setPdfComponent(module?.default ?? module);
          setPdfSupported(true);
        }
      } catch {
        if (mounted) {
          setPdfSupported(false);
          setPdfComponent(null);
        }
      }
    };

    loadPdfModule();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    setCurrentPage(1);
    setTotalPages(0);
    setWebFallbackError(false);
  }, [visible, uri]);

  useEffect(() => {
    if (visible && !pdfSupported) {
      setIsLoading(false);
    }
  }, [visible, pdfSupported]);

  const normalizedUri = normalizeFileUri(uri) || uri;
  const isRemotePdf = isRemoteUri(normalizedUri) && isPdfUri(normalizedUri, fileName);
  const canUseInAppWebFallback = !pdfSupported && isRemotePdf;
  const webPreviewUri = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(normalizedUri)}`;

  const openFallback = async () => {
    try {
      if (isRemoteUri(normalizedUri)) {
        await WebBrowser.openBrowserAsync(normalizedUri);
        return;
      }
      const result = await openUriExternally(normalizedUri);
      if (result.success) {
        return;
      }

      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        Alert.alert(
          'Unable to open PDF in Expo Go',
          'PDF viewing is only available in production builds. For Google Drive files, open with your device\'s default PDF app.'
        );
      } else {
        Alert.alert(
          'Unable to open PDF',
          result.reason || 'No compatible viewer is available on this device. Install a PDF reader app.'
        );
      }
    } catch {
      Alert.alert('Unable to open PDF', 'Something went wrong while opening this PDF.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
              {fileName}
            </Text>
            {totalPages > 0 && (
              <Text style={[styles.pageInfo, { color: colors.textSecondary }]}>
                Page {currentPage} of {totalPages}
              </Text>
            )}
          </View>
          <View style={styles.spacer} />
        </View>

        <View style={[styles.pdfContainer, { backgroundColor: colors.surface }]}>
          {isLoading && pdfSupported && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Loading PDF...</Text>
            </View>
          )}
                  {pdfSupported && PdfComponent ? (
            <PdfComponent
                      source={{ uri: normalizedUri }}
              onLoadComplete={(numberOfPages: number) => {
                setTotalPages(numberOfPages);
                setIsLoading(false);
              }}
              onPageChanged={(page: number) => {
                setCurrentPage(page);
              }}
              onError={(error: unknown) => {
                console.log('PDF error:', error);
                setIsLoading(false);
              }}
              style={[styles.pdf, { width, height: height - 100 }]}
              trustAllCerts={false}
            />
          ) : canUseInAppWebFallback && !webFallbackError ? (
            <WebView
              source={{ uri: webPreviewUri }}
              startInLoadingState
              onLoadEnd={() => setIsLoading(false)}
              onError={() => {
                setWebFallbackError(true);
                setIsLoading(false);
              }}
              style={[styles.pdf, { width, height: height - 100 }]}
            />
          ) : (
            <View style={styles.fallbackContainer}>
              <Ionicons name="document-text-outline" size={46} color={colors.textSecondary} />
              <Text style={[styles.fallbackTitle, { color: colors.text }]}>In-app PDF preview is unavailable</Text>
              <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>Open this PDF with browser or a device PDF app.</Text>
              <TouchableOpacity style={[styles.fallbackButton, { backgroundColor: colors.primary }]} onPress={openFallback}>
                <Text style={styles.fallbackButtonText}>Open PDF</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  pageInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  spacer: {
    width: 40,
  },
  pdfContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdf: {
    flex: 1,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  fallbackContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 14,
    textAlign: 'center',
  },
  fallbackButton: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fallbackButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

