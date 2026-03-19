const FALLBACK_API_URL = 'https://multiparous-dax-tepidly.ngrok-free.dev';

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

const envPrimary = process.env.EXPO_PUBLIC_API_URL;
const envSecondary = process.env.EXPO_PUBLIC_BACKEND_URL;

const API_BASE_URLS = [envPrimary, envSecondary, FALLBACK_API_URL]
  .filter((value): value is string => Boolean(value && value.trim()))
  .map((value) => normalizeUrl(value));

const uniqueApiBaseUrls = [...new Set(API_BASE_URLS)];

const API_BASE_URL = uniqueApiBaseUrls[0] || FALLBACK_API_URL;

export { uniqueApiBaseUrls as API_BASE_URL_CANDIDATES };
export default API_BASE_URL;

