'use client';

import { CUISINE_GROUPS, type CuisineGroup } from '@/lib/cuisine';
import { useT } from './LocaleProvider';
import ThemePicker from './ThemePicker';
import { EMPTY_PREFS, type Preferences } from '@/lib/preferences';
import type { Meetup } from '@/lib/history';

interface Props {
  prefs: Preferences;
  update: (fn: (p: Preferences) => Preferences) => void;
  /** id → name for favourites / hidden places seen in results */
  names: Record<string, string>;
  history: Meetup[];
  onHistory: (h: Meetup[]) => void;
}

const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

export default function PrefsPanel({ prefs, update, names, history, onHistory }: Props) {
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
      <ThemePicker />
      {group(t.likesLabel, 'likes', 'like')}
      {group(t.avoidsLabel, 'avoids', 'avoid')}
      {list(t.favouritesLabel, 'favourites', t.remove)}
      {list(t.hiddenLabel, 'hidden', t.unhide)}
      <p className="text-xs text-slate-400">{t.prefsNote}</p>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-slate-600">{t.pastMeetups}</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">{t.noPast}</p>
        ) : (
          <ul className="space-y-2">
            {[...history].reverse().slice(0, 6).map((m) => (
              <li key={m.id} className="rounded-md bg-slate-50 p-2 text-xs">
                <p className="font-medium">
                  {m.venue} · <span className="text-slate-500">{new Date(m.date).toLocaleDateString()}</span>
                </p>
                <p className="mt-1 text-slate-500">{t.reallyTook}</p>
                <ul className="mt-1 space-y-1">
                  {m.people.map((p, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {p.mode === 'metro' ? '🚇' : '🚗'} {p.name} · {t.minutes(p.minutes)}
                      </span>
                      {p.actual != null ? (
                        <span className="text-emerald-700">{t.minutes(p.actual)} ✓</span>
                      ) : (
                        <form
                          className="flex gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = Number(new FormData(e.currentTarget).get('actual'));
                            if (!(v > 0 && v < 300)) return;
                            void fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: p.mode, estimated: p.minutes, actual: v }) });
                            onHistory(history.map((h) => (h.id === m.id ? { ...h, people: h.people.map((q, j) => (j === i ? { ...q, actual: v } : q)) } : h)));
                          }}
                        >
                          <input name="actual" type="number" min={1} max={300} inputMode="numeric" aria-label={t.reallyTook} className="w-14 rounded border border-slate-300 px-1 py-0.5" />
                          <button type="submit" className="rounded bg-brand px-2 text-white">
                            {t.sendReport}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => update(() => EMPTY_PREFS)}>
        {t.clearAll}
      </button>
    </div>
  );
}
