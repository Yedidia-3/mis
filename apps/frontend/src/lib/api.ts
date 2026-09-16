const envBase = import.meta.env.VITE_API_URL?.trim();

// Hardcoded production fallback to guarantee network routing to Railway
const productionFallback = 'https://mis-misapi.up.railway.app/api/v1';

const rawBase = envBase || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : productionFallback);

// Remove trailing slashes from the base URL
export const BASE_URL = rawBase.replace(/\/+$/, '');

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  // Sanitize path to ensure exact slash formatting
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${BASE_URL}${cleanPath}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 && token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? err?.data?.message ?? `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  get:    <T>(path: string)                => apiFetch<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                => apiFetch<T>(path, { method: 'DELETE' }),
};