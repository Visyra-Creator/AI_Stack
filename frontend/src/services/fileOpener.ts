import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const isRemoteUri = (uri: string) => uri.startsWith('http://') || uri.startsWith('https://');

export const normalizeFileUri = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://')
  ) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as { uri?: string };
    return parsed?.uri?.trim() || undefined;
  } catch {
    return undefined;
  }
};

export const isPdfUri = (uri: string, fileName?: string) => {
  const lowerUri = uri.toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  return lowerName.endsWith('.pdf') || lowerUri.endsWith('.pdf') || lowerUri.includes('.pdf?') || lowerUri.includes('application/pdf');
};

export const openUriExternally = async (uri: string): Promise<{ success: boolean; reason?: string }> => {
  const target = normalizeFileUri(uri);
  if (!target) return { success: false, reason: 'URI is empty' };

  if (isRemoteUri(target)) {
    try {
      await Linking.openURL(target);
      return { success: true };
    } catch {
      return { success: false, reason: 'Failed to open remote URL' };
    }
  }

  // Handle content:// URIs (Google Drive files on Android)
  if (target.startsWith('content://')) {
    try {
      await Linking.openURL(target);
      return { success: true };
    } catch {
      // Fall through to other attempts
    }
  }

  if (Platform.OS === 'android' && target.startsWith('file://')) {
    try {
      const contentUri = await FileSystem.getContentUriAsync(target);
      const canOpenContentUri = await Linking.canOpenURL(contentUri);
      if (canOpenContentUri) {
        await Linking.openURL(contentUri);
        return { success: true };
      }
    } catch {
      // Fall back to the original URI open path below.
    }
  }

  try {
    const canOpen = await Linking.canOpenURL(target);
    if (!canOpen) {
      return { success: false, reason: 'No app found to open this file type' };
    }
    await Linking.openURL(target);
    return { success: true };
  } catch {
    if (target.startsWith('file://')) {
      return { success: false, reason: 'File is unavailable or no compatible app is installed' };
    }
    if (target.startsWith('content://')) {
      return { success: false, reason: 'Cannot access this file URI on this device' };
    }
    return { success: false, reason: 'No app found to open this file type' };
  }
};

