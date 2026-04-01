export const POCKETBASE_URL = process.env.EXPO_PUBLIC_POCKETBASE_URL?.trim() || '';

export const POCKETBASE_URL_CONFIGURED = POCKETBASE_URL.length > 0;

export const CLOUD_SYNC_ENABLED =
  process.env.EXPO_PUBLIC_USE_POCKETBASE === 'true' &&
  POCKETBASE_URL_CONFIGURED;

