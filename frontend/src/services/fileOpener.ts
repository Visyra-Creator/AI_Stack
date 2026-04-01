import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const isRemoteUri = (uri: string) => uri.startsWith('http://') || uri.startsWith('https://');

export const openUriExternally = async (uri: string): Promise<boolean> => {
  const target = uri.trim();
  if (!target) return false;

  if (isRemoteUri(target)) {
    try {
      await Linking.openURL(target);
      return true;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'android' && target.startsWith('file://')) {
    try {
      const contentUri = await FileSystem.getContentUriAsync(target);
      await Linking.openURL(contentUri);
      return true;
    } catch {
      // Fall back to the original URI open path below.
    }
  }

  try {
    await Linking.openURL(target);
    return true;
  } catch {
    return false;
  }
};

