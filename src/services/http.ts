const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api/v1';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_AUTH = /^\/auth\/(login|register|refresh|csrf-token|forgot-password|reset-password|verify-email|resend-verification)(?:$|\?)/;
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let refreshRequest: Promise<void> | null = null;
let pendingWrites = 0;
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
function emit(name: string, detail?: unknown) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}
async function fetchWithTimeout(url: string, init?: RequestInit) {
  try { return await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(30000) }); }
  catch { throw new ApiError(0, 'We could not connect to SOPET Momentum. Please try again.'); }
}
async function loadCsrfToken(): Promise<string> {
  if (!csrfRequest) csrfRequest = (async () => {
    const response = await fetchWithTimeout(`${API_BASE}/auth/csrf-token`, { credentials: 'include' });
    if (!response.ok) throw new ApiError(response.status, 'Secure connection unavailable. Please try again.');
    const body = await response.json();
    csrfToken = body.data?.csrfToken ?? body.csrfToken ?? null;
    if (!csrfToken) throw new ApiError(0, 'Secure connection unavailable. Please try again.');
    return csrfToken;
  })().finally(() => { csrfRequest = null; });
  return csrfRequest;
}
async function send(path: string, init: RequestInit) {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!SAFE_METHODS.has(method)) headers.set('X-CSRF-Token', csrfToken ?? await loadCsrfToken());
  let response = await fetchWithTimeout(`${API_BASE}${path}`, { ...init, method, credentials: 'include', headers });
  if (response.status === 403 && !SAFE_METHODS.has(method)) {
    const body = await response.clone().json().catch(() => null);
    if (body?.error?.code === 'CSRF_TOKEN_INVALID' || body?.code === 'CSRF_TOKEN_INVALID') {
      headers.set('X-CSRF-Token', await loadCsrfToken());
      response = await fetchWithTimeout(`${API_BASE}${path}`, { ...init, method, credentials: 'include', headers });
    }
  }
  return response;
}
async function renewSession() {
  if (!refreshRequest) refreshRequest = (async () => {
    const response = await send('/auth/refresh', { method: 'POST', body: '{}' });
    if (!response.ok) throw new ApiError(response.status, response.status === 401 ? 'Your session has expired. Sign in again to continue.' : 'Session renewal is unavailable. Please try again.');
  })().finally(() => { refreshRequest = null; });
  return refreshRequest;
}
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const mutation = !SAFE_METHODS.has((init.method ?? 'GET').toUpperCase());
  if (mutation) emit('sopet:pending', ++pendingWrites);
  try {
    let response = await send(path, init);
    if (response.status === 401 && !PUBLIC_AUTH.test(path)) {
      try { await renewSession(); response = await send(path, init); }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) emit('sopet:session-expired');
        throw error;
      }
      if (response.status === 401) emit('sopet:session-expired');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.error?.message ?? body?.message;
      const fallback: Record<number, string> = { 401: 'Sign in to continue.', 403: 'You do not have permission to perform this action.', 404: 'This item could not be found.', 429: 'Too many requests. Please wait and try again.' };
      throw new ApiError(response.status, response.status >= 500 ? 'The service is temporarily unavailable. Please try again.' : typeof message === 'string' ? message : fallback[response.status] ?? 'Please check your entries and try again.', body?.error?.code ?? body?.code);
    }
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    return (typeof body === 'object' && body !== null && 'data' in body ? body.data : body) as T;
  } finally { if (mutation) emit('sopet:pending', --pendingWrites); }
}
export function clearCsrfToken() { csrfToken = null; }
