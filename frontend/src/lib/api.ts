const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

let _accessToken: string | null = null;
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) {
    try { localStorage.setItem('access_token', token); } catch {}
    scheduleRefresh(token);
  } else {
    try { localStorage.removeItem('access_token'); } catch {}
    if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  }
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  try { _accessToken = localStorage.getItem('access_token'); } catch {}
  return _accessToken;
}

function scheduleRefresh(token: string) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const now = Date.now();
    const refreshIn = Math.max(10000, exp - now - 120000); // 2 min before expiry
    _refreshTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: _accessToken ? { 'Authorization': `Bearer ${_accessToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            _accessToken = data.access_token;
            try { localStorage.setItem('access_token', data.access_token); } catch {}
            scheduleRefresh(data.access_token);
          }
        }
      } catch {}
    }, refreshIn);
  } catch {}
}

// Initialize refresh on load
if (typeof window !== 'undefined') {
  const existing = getAccessToken();
  if (existing) scheduleRefresh(existing);
}

function formatError(detail: any): string {
  if (detail == null) return 'Something went wrong.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail.map((e: any) => e?.msg || JSON.stringify(e)).filter(Boolean).join(' ');
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(formatError(err.detail));
  }
  return res.json();
}

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut<T = any>(path: string, body: any): Promise<T> {
  return api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  return api<T>(path, { method: 'DELETE' });
}
