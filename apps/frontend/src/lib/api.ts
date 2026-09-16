// Sanitize raw environment variable
const envBase = import.meta.env.VITE_API_URL?.trim();

// Direct Railway fallback for production to guarantee app stability
const productionFallback = 'https://mis-misapi.up.railway.app/api/v1';

// Format base URL by stripping trailing slashes
const rawBase = envBase || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : productionFallback);
export const BASE_URL = rawBase.replace(/\/+$/, '');

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  // Sanitize route path to ensure it starts with a single '/'
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
    // Only force a redirect when an EXISTING session expired (a token was sent).
    // A 401 from the login attempt itself (no token yet) must NOT reload the
    // page — let the LoginScreen show an inline error instead.
    if (res.status === 401 && token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const err = await res.json().catch(() => ({}));
    // Unwrap error from NestJS interceptor envelope { success, data, message }
    throw new Error(err?.message ?? err?.data?.message ?? `Request failed: ${res.status}`);
  }

  const json = await res.json();
  // NestJS ResponseInterceptor wraps every response as { success, data, message }.
  // Unwrap transparently so callers get the raw payload.
  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  get:    <T>(path: string)                => apiFetch<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                => apiFetch<T>(path, { method: 'DELETE' }),
};