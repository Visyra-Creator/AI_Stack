export interface ItemWithImages {
  image?: string;
  images?: string[];
}

export const resolveImageUri = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as { uri?: string };
    return parsed?.uri;
  } catch {
    return undefined;
  }
};

export const getImageUris = (item: ItemWithImages): string[] => {
  const fromImages = (item.images || []).map(resolveImageUri).filter((uri): uri is string => !!uri);
  const legacy = resolveImageUri(item.image);
  const merged = legacy ? [legacy, ...fromImages] : fromImages;
  return Array.from(new Set(merged));
};

export const getPrimaryImageUri = (item: ItemWithImages): string | undefined => {
  const uris = getImageUris(item);
  return uris[0];
};

