'use client';

import { BedDouble, GraduationCap, Hospital, Landmark as LandmarkIcon, MapPin, Plane, ShoppingBag, TrainFront, Trees, Trophy, Flag } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useLocale, useT } from './LocaleProvider';
import type { District } from '@/lib/districts';
import { searchPlaces, type Landmark, type LandmarkKind, type PlaceHit } from '@/lib/places';

const ICONS: Record<LandmarkKind | 'district', typeof MapPin> = {
  district: MapPin,
  area: MapPin,
  mall: ShoppingBag,
  hotel: BedDouble,
  university: GraduationCap,
  hospital: Hospital,
  park: Trees,
  stadium: Trophy,
  museum: LandmarkIcon,
  airport: Plane,
  station: TrainFront,
  embassy: Flag,
};

// shared by every person's search box: one download, then all boxes are told
let landmarkCache: Landmark[] | null = null;
let landmarkLoad: Promise<Landmark[]> | null = null;
function loadLandmarks(): Promise<Landmark[]> {
  landmarkLoad ??= fetch('/api/landmarks')
    .then((r) => r.json() as Promise<{ landmarks: Landmark[] }>)
    .then((d) => (landmarkCache = d.landmarks))
    .catch(() => {
      landmarkLoad = null;
      return [];
    });
  return landmarkLoad;
}

/** Type-ahead for a starting point: neighbourhoods, well-known areas, malls, hotels, universities… (offline). */
export default function NeighbourhoodPicker({ districts, onSelect, autoFocus = false }: { districts: District[]; onSelect: (hit: PlaceHit) => void; autoFocus?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [landmarks, setLandmarks] = useState<Landmark[]>(landmarkCache ?? []);
  const listId = useId();

  function ensureLandmarks() {
    if (landmarks.length) return;
    void loadLandmarks().then((l) => l.length && setLandmarks(l));
  }

  const matches = useMemo(() => searchPlaces(query, districts, landmarks), [query, districts, landmarks]);

  function choose(h: PlaceHit) {
    setQuery('');
    setOpen(false);
    onSelect(h);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        role="combobox"
        autoFocus={autoFocus}
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          ensureLandmarks();
          setOpen(true);
        }}
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
        className="w-full rounded-xl border border-sand-dark bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-sand-dark bg-white py-1 shadow-card">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-soft">{t.noMatches}</li>
          ) : (
            matches.map((h, i) => {
              const Icon = ICONS[h.type === 'district' ? 'district' : h.kind];
              const main = locale === 'ar' ? h.ar || h.en : h.en;
              const other = locale === 'ar' ? h.en : h.ar !== h.en ? h.ar : '';
              return (
                <li
                  key={h.type + h.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? 'bg-brand-light' : ''}`}
                >
                  <Icon size={16} className="shrink-0 text-ink-soft" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{main}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {h.type === 'district' ? t.kindDistrict : t.landmarkKinds[h.kind]}
                      {other ? ` · ${other}` : ''}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

