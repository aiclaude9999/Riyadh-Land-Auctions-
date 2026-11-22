'use client';

import { useEffect, useState } from 'react';
import ClubBadge from './ClubBadge';
import { useLocale } from './LocaleProvider';
import { DEFAULT_THEME, themeById } from '@/lib/themes';

/** The chosen club's logo next to the app logo (nothing for the default theme). */
export default function ClubMark({ size = 28 }: { size?: number }) {
  const { locale } = useLocale();
  const [id, setId] = useState(DEFAULT_THEME);
  useEffect(() => {
    setId(document.documentElement.dataset.theme || DEFAULT_THEME);
    const on = (e: Event) => setId((e as CustomEvent<string>).detail);
    window.addEventListener('themechange', on);
    return () => window.removeEventListener('themechange', on);
  }, []);
  const theme = themeById(id);
  if (theme.id === DEFAULT_THEME) return null;
  return (
    <span title={locale === 'ar' ? theme.ar : theme.en} className="inline-flex shrink-0">
      <ClubBadge theme={theme} locale={locale} size={size} />
    </span>
  );
}
