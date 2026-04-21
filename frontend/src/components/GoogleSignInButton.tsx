'use client';

import { useEffect, useRef } from 'react';
import { apiPost, setAccessToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    google?: any;
    __unify_google_initialized?: boolean;
  }
}

interface Props {
  onSuccess?: (user: any) => void;
  onError?: (err: Error) => void;
  role?: 'student' | 'mentor' | 'employer' | 'placement';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}

export function GoogleSignInButton({ onSuccess, onError, role = 'student', text = 'continue_with' }: Props) {
  const btnRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      console.warn('[UNIFY Auth] NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured');
      return;
    }
    const init = () => {
      if (!window.google?.accounts?.id || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            const data: any = await apiPost('/api/auth/google/verify', {
              credential: response.credential,
              role,
            });
            if (data.access_token) setAccessToken(data.access_token);
            onSuccess?.(data);
            const target = `/dashboard/${data.role || 'student'}`;
            router.push(target);
          } catch (e: any) {
            console.error('[UNIFY Auth] Google verify failed:', e);
            onError?.(e);
          }
        },
        auto_select: false,
        ux_mode: 'popup',
      });
      // Clear previous render
      btnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'filled_black',
        size: 'large',
        type: 'standard',
        text,
        shape: 'rectangular',
        logo_alignment: 'center',
        width: 320,
      });
      window.__unify_google_initialized = true;
    };
    if (window.google?.accounts?.id) {
      init();
    } else {
      // Poll briefly until GIS script (loaded in <head>) is ready
      const handle = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(handle);
          init();
        }
      }, 120);
      const safety = setTimeout(() => clearInterval(handle), 8000);
      return () => {
        clearInterval(handle);
        clearTimeout(safety);
      };
    }
  }, [clientId, role, text, onSuccess, onError, router]);

  if (!clientId) {
    return (
      <div className="text-xs text-[var(--text-muted)] text-center py-3">
        Google sign-in unavailable — admin: set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
      </div>
    );
  }
  return <div ref={btnRef} className="flex justify-center" data-testid="google-signin-mount" />;
}
