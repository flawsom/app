'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from './en.json';
import hi from './hi.json';
import te from './te.json';
import ta from './ta.json';
import or_lang from './or.json';

export type Locale = 'en' | 'hi' | 'te' | 'ta' | 'or';

const TRANSLATIONS: Record<Locale, any> = { en, hi, te, ta, or: or_lang };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  te: 'తెలుగు',
  ta: 'தமிழ்',
  or: 'ଓଡ଼ିଆ',
};

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('locale') as Locale;
      if (saved && TRANSLATIONS[saved]) setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') localStorage.setItem('locale', l);
  }, []);

  const t = useCallback((key: string): string => {
    // key format: "section.key" e.g. "auth.signIn"
    const parts = key.split('.');
    let val: any = TRANSLATIONS[locale];
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined) break;
    }
    if (typeof val === 'string') return val;
    // Fallback to English
    val = TRANSLATIONS.en;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined) break;
    }
    return typeof val === 'string' ? val : key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
