'use client';

import type { Dispatch } from 'react';
import NeighbourhoodPicker from './NeighbourhoodPicker';
import PlaceSearch from './PlaceSearch';
import type { District } from '@/lib/districts';
import { t } from '@/lib/i18n';
import { nearestStations, type Station } from '@/lib/metro';
import { displayName, personColor, personIssues, type PeopleAction, type Person, type TravelMode } from '@/lib/people';

interface Props {
  person: Person;
  index: number;
  canRemove: boolean;
  dispatch: Dispatch<PeopleAction>;
  stations: Station[];
  picking: boolean;
  onPick: () => void;
  districts: District[];
  onDistrict: (d: District) => void;
}

// Google address search needs the paid Google key; without it the free neighbourhood list is used.
const HAS_GOOGLE = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

const MODES: { mode: TravelMode; label: string; icon: string }[] = [
  { mode: 'car', label: t.car, icon: '🚗' },
  { mode: 'metro', label: t.metro, icon: '🚇' },
];

export default function PersonCard({ person, index, canRemove, dispatch, stations, picking, onPick, districts, onDistrict }: Props) {
  const color = personColor(index);
  const issues = personIssues(person);
  const nearest = person.mode === 'metro' && person.location ? nearestStations(person.location, stations, 1)[0] : undefined;
  const nameId = `name-${person.id}`;

  return (
    <li className={`rounded-xl border bg-white p-3 shadow-sm transition ${picking ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }} aria-hidden>
          {(displayName(person, index)[0] ?? '?').toUpperCase()}
        </span>
        <label htmlFor={nameId} className="sr-only">
          {t.nameLabel}
        </label>
        <input
          id={nameId}
          value={person.name}
          onChange={(e) => dispatch({ type: 'rename', id: person.id, name: e.target.value })}
          placeholder={t.namePlaceholder(index + 1)}
          maxLength={40}
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 font-medium hover:border-slate-200 focus:border-brand focus:outline-none"
        />
        {canRemove && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'remove', id: person.id })}
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`${t.removePerson} ${displayName(person, index)}`}
          >
            {t.removePerson}
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label={t.modeLabel} className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {MODES.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={person.mode === mode}
            onClick={() => dispatch({ type: 'setMode', id: person.id, mode })}
            className={`rounded-md px-2 py-1 text-sm ${person.mode === mode ? 'bg-white font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span aria-hidden>{icon}</span> {label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        <span className="text-xs font-medium text-slate-500">{t.locationLabel}</span>
        {person.location ? (
          <div className="mt-1 flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-sm">
            <span className="mt-0.5" aria-hidden>📍</span>
            <div className="min-w-0 flex-1">
              <p className="truncate">{person.address ?? t.pinnedOnMap}</p>
              <p className="text-xs text-slate-400">
                {person.location.lat.toFixed(5)}, {person.location.lng.toFixed(5)}
              </p>
            </div>
            <button type="button" onClick={onPick} className="text-xs text-brand hover:underline">
              {picking ? t.cancel : t.pickOnMap}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'clearLocation', id: person.id })} className="text-xs text-slate-400 hover:text-rose-600">
              {t.clearLocation}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex gap-2">
            {HAS_GOOGLE ? (
              <PlaceSearch
                onSelect={(place) => dispatch({ type: 'setLocation', id: person.id, location: place.location, address: place.label, source: 'search' })}
              />
            ) : (
              <NeighbourhoodPicker districts={districts} onSelect={onDistrict} />
            )}
            <button
              type="button"
              onClick={onPick}
              className={`shrink-0 self-start rounded-lg border px-2.5 py-1.5 text-sm ${picking ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand'}`}
            >
              {picking ? t.picking : t.pickOnMap}
            </button>
          </div>
        )}

        {issues.includes('missingLocation') && !picking && <p className="mt-1 text-xs text-amber-700">{t.missingLocation}</p>}
        {issues.includes('outsideRiyadh') && <p className="mt-1 text-xs text-amber-700">{t.outsideRiyadh}</p>}
        {nearest && (
          <p className="mt-1 text-xs text-slate-500">
            {t.nearestStation(nearest.station.name_en, (nearest.meters / 1000).toFixed(1))}
          </p>
        )}
      </div>
    </li>
  );
}
