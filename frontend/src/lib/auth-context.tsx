'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, apiPost, setAccessToken, getAccessToken } from './api';
import { User } from '@/types';

interface AuthCtx {
  user: User | null | false;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | false>(null);
  const oauthProcessed = useRef(false);

  const checkAuth = useCallback(async () => {
    const token = getAccessToken();
    if (!token) { setUser(false); return; }
    try {
      const data = await api<User>('/api/auth/me');
      setUser(data);
    } catch {
      setAccessToken(null);
      setUser(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from Google OAuth, skip /me check.
    // Let the OAuth handler process session_id first.
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      // Process OAuth callback
      if (oauthProcessed.current) return;
      oauthProcessed.current = true;
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const sessionId = params.get('session_id');
      if (sessionId) {
        (async () => {
          try {
            const data = await apiPost<any>('/api/auth/google/session', { session_id: sessionId });
            if (data.access_token) setAccessToken(data.access_token);
            setUser(data);
            // Clean URL hash
            window.history.replaceState(null, '', window.location.pathname);
          } catch (e) {
            console.error('OAuth callback failed:', e);
            setUser(false);
            window.location.href = '/login';
          }
        })();
      }
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const data = await apiPost<any>('/api/auth/login', { email, password });
    if (data.access_token) setAccessToken(data.access_token);
    setUser(data);
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const data = await apiPost<any>('/api/auth/register', { email, password, name, role });
    if (data.access_token) setAccessToken(data.access_token);
    setUser(data);
  };

  const logout = async () => {
    try { await apiPost('/api/auth/logout', {}); } catch {}
    setAccessToken(null);
    setUser(false);
  };

  const refresh = async () => { await checkAuth(); };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
