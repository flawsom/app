'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, apiPost, setAccessToken, getAccessToken } from './api';
import { User } from '@/types';

interface AuthCtx {
  user: User | null | false;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUserDirect: (u: User) => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refresh: async () => {},
  setUserDirect: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | false>(null);

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

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const data: any = await apiPost('/api/auth/login', { email, password });
    if (data.access_token) setAccessToken(data.access_token);
    setUser(data);
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const data: any = await apiPost('/api/auth/register', { email, password, name, role });
    if (data.access_token) setAccessToken(data.access_token);
    setUser(data);
  };

  const logout = async () => {
    try { await apiPost('/api/auth/logout', {}); } catch {
      // no-op: even if server call fails we still clear client state
    }
    setAccessToken(null);
    setUser(false);
  };

  const refresh = async () => { await checkAuth(); };

  const setUserDirect = (u: User) => { setUser(u); };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh, setUserDirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
