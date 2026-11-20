'use client';

import { CUISINE_GROUPS, type CuisineGroup } from '@/lib/cuisine';
import { useT } from './LocaleProvider';
import { EMPTY_PREFS, type Preferences } from '@/lib/preferences';

interface Props {
  prefs: Preferences;
  update: (fn: (p: Preferences) => Preferences) => void;
  /** id → name for favourites / hidden places seen in results */
  names: Record<string, string>;
}

const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

export default function PrefsPanel({ prefs, update, names }: Props) {
  const t = useT();
  const chip = (active: boolean, tone: 'like' | 'avoid') =>
    `rounded-full border px-2.5 py-1 text-xs ${active ? (tone === 'like' ? 'border-brand bg-brand-light text-brand-dark' : 'border-rose-300 bg-rose-50 text-rose-700') : 'border-slate-300 text-slate-600 hover:border-slate-400'}`;

  const group = (label: string, key: 'likes' | 'avoids', tone: 'like' | 'avoid') => (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold text-slate-600">{label}</h3>
      <div className="flex flex-wrap gap-1.5">
        {CUISINE_GROUPS.map((g: CuisineGroup) => (
          <button
            key={g}
            type="button"
            aria-pressed={prefs[key].includes(g)}
            className={chip(prefs[key].includes(g), tone)}
            onClick={() =>
              update((p) => {
                const other = key === 'likes' ? 'avoids' : 'likes';
                return { ...p, [key]: toggle(p[key], g), [other]: p[other].filter((x) => x !== g) };
              })
            }
          >
            {tone === 'avoid' && prefs[key].includes(g) ? '✕ ' : ''}
            {t.groups[g]}
          </button>
        ))}
      </div>
    </section>
  );

  const list = (label: string, key: 'favourites' | 'hidden', action: string) => (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold text-slate-600">{label}</h3>
      {prefs[key].length === 0 ? (
        <p className="text-xs text-slate-400">{t.noneYet}</p>
      ) : (
        <ul className="space-y-1">
          {prefs[key].map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm">
              <span className="truncate">{names[id] ?? id}</span>
              <button type="button" className="shrink-0 text-xs text-brand hover:underline" onClick={() => update((p) => ({ ...p, [key]: p[key].filter((x) => x !== id) }))}>
                {action}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <p className="text-xs text-slate-500">{t.prefsIntro}</p>
      {group(t.likesLabel, 'likes', 'like')}
      {group(t.avoidsLabel, 'avoids', 'avoid')}
      {list(t.favouritesLabel, 'favourites', t.remove)}
      {list(t.hiddenLabel, 'hidden', t.unhide)}
      <p className="text-xs text-slate-400">{t.prefsNote}</p>
      <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => update(() => EMPTY_PREFS)}>
        {t.clearAll}
      </button>
    </div>
  );
}
