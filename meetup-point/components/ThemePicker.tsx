'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import ClubBadge from './ClubBadge';
import { useLocale, useT } from './LocaleProvider';
import { applyTheme, DEFAULT_THEME, THEMES } from '@/lib/themes';

/** App colours: default green or a club's colours. Saved on this device. */
export default function ThemePicker() {
  const t = useT();
  const { locale } = useLocale();
  const [current, setCurrent] = useState(DEFAULT_THEME);
  useEffect(() => setCurrent(document.documentElement.dataset.theme || DEFAULT_THEME), []);

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold text-slate-600">{t.themeTitle}</h3>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.themeTitle}>
        {THEMES.map((th) => {
          const on = th.id === current;
          return (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                applyTheme(th.id);
                setCurrent(th.id);
              }}
              className={`flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 text-start text-sm ${on ? 'border-brand ring-2 ring-brand/30' : 'border-sand-dark hover:border-brand'} ${th.id === 'riyadh' ? 'col-span-2' : ''}`}
            >
              <ClubBadge theme={th} locale={locale} size={30} />
              <span className="min-w-0 flex-1 truncate font-medium">{locale === 'ar' ? th.ar : th.en}</span>
              <span className="flex shrink-0 gap-0.5" aria-hidden>
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: th.brand }} />
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: th.accent }} />
              </span>
              {on && <Check size={16} className="shrink-0 text-brand" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{t.themeNote}</p>
    </section>
  );
}
