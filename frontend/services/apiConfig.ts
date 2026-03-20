import Constants from 'expo-constants';

const FALLBACK_API_URL = 'http://localhost:8000';

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

const envPrimary = process.env.EXPO_PUBLIC_API_URL;
const envSecondary = process.env.EXPO_PUBLIC_BACKEND_URL;
const envList = (process.env.EXPO_PUBLIC_API_URLS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const hostUri = Constants.expoConfig?.hostUri || '';
const hostFromExpo = hostUri.split(':')[0]?.trim();
const lanDevApiUrl = hostFromExpo ? `http://${hostFromExpo}:8000` : '';

const API_BASE_URLS = [
  envPrimary,
  envSecondary,
  ...envList,
  lanDevApiUrl,
  'http://10.0.2.2:8000',
  FALLBACK_API_URL,
]
  .filter((value): value is string => Boolean(value && value.trim()))
  .map((value) => normalizeUrl(value));

const uniqueApiBaseUrls = [...new Set(API_BASE_URLS)];

const API_BASE_URL = uniqueApiBaseUrls[0] || FALLBACK_API_URL;

export { uniqueApiBaseUrls as API_BASE_URL_CANDIDATES };
export default API_BASE_URL;

