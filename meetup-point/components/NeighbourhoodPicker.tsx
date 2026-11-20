'use client';

import { useId, useMemo, useState } from 'react';
import { searchDistricts, shortAr, shortEn, type District } from '@/lib/districts';
import { useLocale, useT } from './LocaleProvider';

/** Type-ahead list of Riyadh neighbourhoods (works offline, English or Arabic spelling). */
export default function NeighbourhoodPicker({ districts, onSelect }: { districts: District[]; onSelect: (d: District) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const matches = useMemo(() => searchDistricts(query, districts), [query, districts]);

  function choose(d: District) {
    setQuery('');
    setOpen(false);
    onSelect(d);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, matches.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter') choose(matches[active]);
          else if (e.key === 'Escape') setOpen(false);
          else return;
          e.preventDefault();
        }}
        placeholder={t.neighbourhoodPlaceholder}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">{t.noMatches}</li>
          ) : (
            matches.map((d, i) => (
              <li
                key={d.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(d);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-sm ${i === active ? 'bg-brand-light' : ''}`}
              >
                <span className="truncate font-medium">{locale === 'ar' ? shortAr(d) : shortEn(d)}</span>
                <span dir={locale === 'ar' ? 'ltr' : 'rtl'} className="shrink-0 text-slate-500">
                  {locale === 'ar' ? shortEn(d) : shortAr(d)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
