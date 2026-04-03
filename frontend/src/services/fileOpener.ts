import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

type AttachmentMeta = {
  uri?: string;
  name?: string;
  mimeType?: string;
  type?: string;
  url?: string;
};

export const isRemoteUri = (uri: string) => uri.startsWith('http://') || uri.startsWith('https://');

export const normalizeFileUri = (value?: string): string | undefined => {
  const parsed = parseAttachmentValue(value);
  return parsed?.uri;
};

export const parseAttachmentValue = (value?: string): AttachmentMeta | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://')
  ) {
    return { uri: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed) as AttachmentMeta;
    return {
      uri: parsed?.uri?.trim() || parsed?.url?.trim() || undefined,
      name: parsed?.name?.trim() || undefined,
      mimeType: parsed?.mimeType?.trim() || parsed?.type?.trim() || undefined,
    };
  } catch {
    return undefined;
  }
};

const getFileExtension = (name?: string, mimeType?: string) => {
  const normalizedName = (name || '').trim().toLowerCase();
  const nameMatch = normalizedName.match(/\.[a-z0-9]+$/i);
  if (nameMatch?.[0]) return nameMatch[0];

  const normalizedMime = (mimeType || '').trim().toLowerCase();
  if (normalizedMime === 'application/pdf') return '.pdf';
  if (normalizedMime === 'application/msword') return '.doc';
  if (normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  if (normalizedMime === 'text/plain') return '.txt';
  if (normalizedMime === 'application/rtf') return '.rtf';
  if (normalizedMime === 'application/vnd.ms-excel') return '.xls';
  if (normalizedMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return '.xlsx';
  return '';
};

export const isPdfUri = (uri: string, fileName?: string) => {
  const lowerUri = uri.toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  return lowerName.endsWith('.pdf') || lowerUri.endsWith('.pdf') || lowerUri.includes('.pdf?') || lowerUri.includes('application/pdf');
};

const openWithLinking = async (target: string) => {
  const canOpen = await Linking.canOpenURL(target);
  if (!canOpen) return false;
  await Linking.openURL(target);
  return true;
};

const materializeAndroidFile = async (sourceUri: string, meta?: AttachmentMeta): Promise<string | undefined> => {
  if (sourceUri.startsWith('http://') || sourceUri.startsWith('https://')) return sourceUri;
  if (!sourceUri.startsWith('file://') && !sourceUri.startsWith('content://')) return sourceUri;

  const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDirectory) return sourceUri;

  const extension = getFileExtension(meta?.name, meta?.mimeType);
  const safeName = `ai-keeper-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const targetUri = `${baseDirectory}${safeName}`;

  try {
    await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
    const copied = await FileSystem.getInfoAsync(targetUri);
    if (!copied.exists) {
      return sourceUri;
    }
    return targetUri;
  } catch {
    return sourceUri;
  }
};

export const openUriExternally = async (uri: string): Promise<{ success: boolean; reason?: string }> => {
  const attachment = parseAttachmentValue(uri);
  const target = attachment?.uri;
  if (!target) return { success: false, reason: 'URI is empty' };

  if (isRemoteUri(target)) {
    try {
      await Linking.openURL(target);
      return { success: true };
    } catch {
      return { success: false, reason: 'Failed to open remote URL' };
    }
  }

  if (Platform.OS === 'android') {
    try {
      const materialized = await materializeAndroidFile(target, attachment);
      if (materialized?.startsWith('file://')) {
        const contentUri = await FileSystem.getContentUriAsync(materialized);
        if (await openWithLinking(contentUri)) {
          return { success: true };
        }
      }

      if (materialized && (await openWithLinking(materialized))) {
        return { success: true };
      }
    } catch {
      // Fall through to the generic open path below.
    }
  }

  if (target.startsWith('content://')) {
    try {
      if (await openWithLinking(target)) {
        return { success: true };
      }
    } catch {
      // Fall through.
    }
  }

  if (Platform.OS === 'android' && target.startsWith('file://')) {
    try {
      const contentUri = await FileSystem.getContentUriAsync(target);
      if (await openWithLinking(contentUri)) {
        return { success: true };
      }
    } catch {
      // Fall back to the original URI open path below.
    }
  }

  try {
    if (await openWithLinking(target)) {
      return { success: true };
    }

    return { success: false, reason: 'No app found to open this file type' };
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

