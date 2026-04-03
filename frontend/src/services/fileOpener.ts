import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { startActivityAsync } from 'expo-intent-launcher';

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

const getExtensionFromUri = (uri?: string) => {
  if (!uri) return '';
  try {
    const clean = uri.split('?')[0]?.split('#')[0] ?? '';
    const match = clean.toLowerCase().match(/\.[a-z0-9]{1,8}$/i);
    return match?.[0] || '';
  } catch {
    return '';
  }
};

const resolveMimeType = (meta?: AttachmentMeta, uri?: string) => {
  const provided = (meta?.mimeType || '').trim().toLowerCase();
  if (provided) return provided;

  const ext = (getFileExtension(meta?.name, meta?.mimeType) || getExtensionFromUri(uri)).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.txt':
      return 'text/plain';
    case '.rtf':
      return 'application/rtf';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default:
      return '*/*';
  }
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

  const extension =
    getFileExtension(meta?.name, meta?.mimeType) ||
    getExtensionFromUri(sourceUri);
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

const openWithAndroidIntent = async (targetUri: string, mimeType: string) => {
  await startActivityAsync('android.intent.action.VIEW', {
    data: targetUri,
    type: mimeType,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
  return true;
};

export const openUriExternally = async (uri: string): Promise<{ success: boolean; reason?: string }> => {
  const attachment = parseAttachmentValue(uri);
  const target = attachment?.uri;
  const mimeType = resolveMimeType(attachment, target);
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
        if (await openWithAndroidIntent(contentUri, mimeType)) {
          return { success: true };
        }
      }

      if (materialized?.startsWith('content://')) {
        if (await openWithAndroidIntent(materialized, mimeType)) {
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
      if (Platform.OS === 'android' && (await openWithAndroidIntent(target, mimeType))) {
        return { success: true };
      }
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
      if (await openWithAndroidIntent(contentUri, mimeType)) {
        return { success: true };
      }
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

