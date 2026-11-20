'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useT } from './LocaleProvider';
import type { LatLng } from '@/lib/geo';

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

type Status = 'idle' | 'loading' | 'no_key' | 'error';

/** Address / place search through our own /api/places routes (the server key never reaches the browser). */
export default function PlaceSearch({ onSelect }: { onSelect: (place: { location: LatLng; label: string }) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<Status>('idle');
  // One session token per search → Google bills autocomplete + details as one session.
  const session = useRef<string>(crypto.randomUUID());
  const listId = useId();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}&session=${session.current}`, { signal: ctrl.signal });
        const data = (await res.json()) as { suggestions?: Suggestion[]; error?: string };
        if (data.error === 'no_key') return setStatus('no_key');
        if (!res.ok) return setStatus('error');
        setSuggestions(data.suggestions ?? []);
        setActive(-1);
        setOpen(true);
        setStatus('idle');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus('error');
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  async function choose(s: Suggestion) {
    setOpen(false);
    setStatus('loading');
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(s.placeId)}&session=${session.current}`);
      const data = (await res.json()) as { place?: { name: string; address: string; location: LatLng }; error?: string };
      if (!res.ok || !data.place) return setStatus(data.error === 'no_key' ? 'no_key' : 'error');
      const label = [s.main, s.secondary].filter(Boolean).join(', ') || data.place.address;
      session.current = crypto.randomUUID();
      setQuery('');
      setStatus('idle');
      onSelect({ location: data.place.location, label });
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="search"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !suggestions.length) return;
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, suggestions.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && active >= 0) choose(suggestions[active]);
          else if (e.key === 'Escape') setOpen(false);
          else return;
          e.preventDefault();
        }}
        placeholder={t.searchPlaceholder}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
      />
      {status === 'loading' && <span className="absolute end-2 top-2 h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand" aria-hidden />}

      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">{t.noMatches}</li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={s.placeId}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className={`cursor-pointer px-3 py-1.5 text-sm ${i === active ? 'bg-brand-light' : 'hover:bg-slate-50'}`}
              >
                <span className="block truncate font-medium">{s.main}</span>
                {s.secondary && <span className="block truncate text-xs text-slate-500">{s.secondary}</span>}
              </li>
            ))
          )}
        </ul>
      )}

      {status === 'no_key' && <p className="mt-1 text-xs text-amber-700">{t.searchNoKey}</p>}
      {status === 'error' && <p className="mt-1 text-xs text-rose-600">{t.searchError}</p>}
    </div>
  );
}
