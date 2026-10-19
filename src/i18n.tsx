import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export { translateMessage } from './i18n-messages';

export type Locale = 'en' | 'es';
export const LOCALE_STORAGE_KEY = 'emwaves.locale';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (english: string, spanish: string) => string;
}

const defaultValue: I18nValue = {
  locale: 'en',
  setLocale: () => {},
  t: (english) => english,
};

const I18nContext = createContext<I18nValue>(defaultValue);

function storedLocale(): Locale {
  try {
    if (typeof window === 'undefined') return 'en';
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? storedLocale());
  const setLocale = useCallback((next: Locale) => {
    if (next === 'en' || next === 'es') setLocaleState(next);
  }, []);
  const t = useCallback((english: string, spanish: string) => locale === 'es' ? spanish : english, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Language switching remains available when browser storage is blocked.
    }
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
