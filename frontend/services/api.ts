import API_BASE_URL, { API_BASE_URL_CANDIDATES } from './apiConfig';

export interface ApiItemPayload {
  category: string;
  title: string;
  description: string;
  notes?: string | null;
  image?: string | null;
  url?: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 9000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const candidates = API_BASE_URL_CANDIDATES.length > 0 ? API_BASE_URL_CANDIDATES : [API_BASE_URL];
  let lastError: Error | null = null;

  for (const baseUrl of candidates) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
        ...init,
      });

      if (!response.ok) {
        const text = await response.text();
        lastError = new Error(`API ${response.status}: ${text || 'Request failed'}`);
        continue;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error as Error;
    }
  }

  const details = candidates.join(', ');
  const message =
    lastError?.message || `Network request failed. Tried: ${details}`;
  throw new Error(message.includes('Tried:') ? message : `${message}. Tried: ${details}`);
}

export const getHealth = () => request<{ status: string }>('/health');

export const getPublicItems = () => request<Array<{ id: number; title: string }>>('/items');

export const getItemsByCategory = (category: string) =>
  request<any[]>(`/api/items?category=${encodeURIComponent(category)}`);

export const getItemById = (id: string) => request<any>(`/api/items/${id}`);

export const createItem = (payload: ApiItemPayload) =>
  request<any>('/api/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateItem = (id: string, payload: ApiItemPayload) =>
  request<any>(`/api/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteItem = (id: string) =>
  request<{ message: string }>(`/api/items/${id}`, {
    method: 'DELETE',
  });

