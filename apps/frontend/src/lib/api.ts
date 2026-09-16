const envBase = import.meta.env.VITE_API_URL?.trim();

// Production fallback link
const productionFallback = 'https://mis-misapi.up.railway.app/api/v1';

const rawBase = envBase || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : productionFallback);

// Strip any trailing '/api/v1' or extra slashes from rawBase so we have a clean root domain
const cleanedRoot = rawBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

// Guarantee BASE_URL ends with a single '/api/v1'
export const BASE_URL = `${cleanedRoot}/api/v1`;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  // Strip leading '/api/v1' from path if it was passed accidentally
  const cleanPath = path.replace(/^\/?api\/v1\/?/, '');
  
  // Format clean relative endpoint with a leading slash
  const formattedEndpoint = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  
  const fullUrl = `${BASE_URL}${formattedEndpoint}`;

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