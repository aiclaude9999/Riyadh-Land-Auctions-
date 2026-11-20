'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DIR, LOCALE_COOKIE, STRINGS, type Locale, type Strings } from '@/lib/i18n';

interface Ctx {
  locale: Locale;
  t: Strings;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<Ctx>({ locale: 'en', t: STRINGS.en, setLocale: () => {} });

/** Holds the language. The choice is kept in a cookie so the server renders the right language first. */
export default function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = DIR[locale];
    document.title = STRINGS[locale].appTitle;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return <LocaleContext.Provider value={{ locale, t: STRINGS[locale], setLocale }}>{children}</LocaleContext.Provider>;
}

export const useT = () => useContext(LocaleContext).t;
export const useLocale = () => useContext(LocaleContext);

/** Picks the Arabic name in Arabic mode when there is one. */
export function useName() {
  const { locale } = useContext(LocaleContext);
  return useCallback((en: string, ar?: string | null) => (locale === 'ar' && ar ? ar : en), [locale]);
}
