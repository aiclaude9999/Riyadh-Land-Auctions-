'use client';

import type { Dispatch } from 'react';
import NeighbourhoodPicker from './NeighbourhoodPicker';
import PlaceSearch from './PlaceSearch';
import type { District } from '@/lib/districts';
import { useName, useT } from './LocaleProvider';
import { shortAr, shortEn } from '@/lib/districts';
import { Car, Footprints, TrainFront } from 'lucide-react';
import { CUISINE_GROUPS } from '@/lib/cuisine';
import { nearestStations, type Station } from '@/lib/metro';
import { personInitial, displayName, personColor, personIssues, type PeopleAction, type Person, type TravelMode } from '@/lib/people';

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
  /** shared group: someone else's entry */
  readOnly?: boolean;
}

// Google address search needs the paid Google key; without it the free neighbourhood list is used.
const HAS_GOOGLE = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;


export default function PersonCard({ person, index, canRemove, dispatch, stations, picking, onPick, districts, onDistrict, readOnly = false }: Props) {
  const t = useT();
  const n = useName();
  const district = person.districtId ? districts.find((d) => d.id === person.districtId) : undefined;
  const districtName = district ? n(shortEn(district), shortAr(district)) : '';
  const label = person.locationSource === 'district' && district ? t.districtCentre(districtName) : person.locationSource === 'pin' && district ? t.pinnedIn(districtName) : (person.address ?? t.pinnedOnMap);
  const MODES: { mode: TravelMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'car', label: t.car, icon: <Car size={15} className="inline" /> },
    { mode: 'metro', label: t.metro, icon: <TrainFront size={15} className="inline" /> },
  ];
  const color = personColor(index);
  const issues = personIssues(person);
  const nearest = person.mode === 'metro' && person.location ? nearestStations(person.location, stations, 1)[0] : undefined;
  const nameId = `name-${person.id}`;

  return (
    <li className={`rounded-2xl border bg-white p-3 shadow-card transition ${picking ? 'border-brand ring-2 ring-brand/30' : 'border-sand-dark'}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }} aria-hidden>
          {personInitial(person, index)}
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
          readOnly={readOnly}
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 font-medium hover:border-slate-200 focus:border-brand focus:outline-none"
        />
        {canRemove && !readOnly && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'remove', id: person.id })}
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`${t.removePerson} ${displayName(person, index, t.namePlaceholder)}`}
          >
            {t.removePerson}
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label={t.modeLabel} className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-sand p-1">
        {MODES.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={person.mode === mode}
            disabled={readOnly}
            onClick={() => dispatch({ type: 'setMode', id: person.id, mode })}
            className={`rounded-md px-2 py-1 text-sm ${person.mode === mode ? 'bg-white font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span aria-hidden>{icon}</span> {label}
          </button>
        ))}
      </div>

      {person.mode === 'metro' && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="text-slate-500">{t.accessLabel}</span>
          {(['walk', 'car'] as const).map((acc) => (
            <button
              key={acc}
              type="button"
              disabled={readOnly}
              aria-pressed={(person.access ?? 'walk') === acc}
              onClick={() => dispatch({ type: 'setAccess', id: person.id, access: acc })}
              className={`rounded-full border px-2 py-0.5 ${(person.access ?? 'walk') === acc ? 'border-brand bg-brand-light text-brand-dark' : 'border-slate-300 text-slate-600'}`}
            >
              {acc === 'walk' ? <Footprints size={13} className="me-1 inline" /> : <Car size={13} className="me-1 inline" />}
              {acc === 'walk' ? t.accessWalk : t.accessCar}
            </button>
          ))}
        </div>
      )}

      <details className="mt-1.5 text-xs">
        <summary className="cursor-pointer select-none text-slate-500">
          🍽 {t.tasteLabel}
          {(person.likes?.length || person.avoids?.length) ? <span className="ms-1 text-brand-dark">({(person.likes?.length ?? 0) + (person.avoids?.length ?? 0)})</span> : null}
        </summary>
        <p className="mt-1 text-xs text-slate-400">{t.tasteHint}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {CUISINE_GROUPS.map((g) => {
            const liked = person.likes?.includes(g);
            const avoided = person.avoids?.includes(g);
            return (
              <button
                key={g}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  // none → like → avoid → none
                  const likes = (person.likes ?? []).filter((x) => x !== g);
                  const avoids = (person.avoids ?? []).filter((x) => x !== g);
                  if (!liked && !avoided) likes.push(g);
                  else if (liked) avoids.push(g);
                  dispatch({ type: 'setTaste', id: person.id, likes, avoids });
                }}
                className={`rounded-full border px-2 py-0.5 ${liked ? 'border-brand bg-brand-light text-brand-dark' : avoided ? 'border-rose-300 bg-rose-50 text-rose-700 line-through' : 'border-slate-300 text-slate-600'}`}
              >
                {liked ? '♥ ' : avoided ? '✕ ' : ''}
                {t.groups[g]}
              </button>
            );
          })}
        </div>
      </details>

      <div className="mt-2">
        <span className="text-xs font-medium text-slate-500">{t.locationLabel}</span>
        {person.location ? (
          <div className="mt-1 flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-sm">
            <span className="mt-0.5" aria-hidden>📍</span>
            <div className="min-w-0 flex-1">
              <p className="truncate">{label}</p>
              <p className="text-xs text-slate-400">
                {person.location.lat.toFixed(5)}, {person.location.lng.toFixed(5)}
              </p>
            </div>
            {!readOnly && (
              <>
                <button type="button" onClick={onPick} className="text-xs text-brand hover:underline">
                  {picking ? t.cancel : t.pickOnMap}
                </button>
                <button type="button" onClick={() => dispatch({ type: 'clearLocation', id: person.id })} className="text-xs text-slate-400 hover:text-rose-600">
                  {t.clearLocation}
                </button>
              </>
            )}
          </div>
        ) : readOnly ? (
          <p className="mt-1 text-xs text-slate-400">{t.missingLocation}</p>
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
        {readOnly && <p className="mt-1 text-xs text-slate-400">🔒 {t.readOnlyPerson}</p>}
        {nearest && (
          <p className="mt-1 text-xs text-slate-500">
            {t.nearestStation(n(nearest.station.name_en, nearest.station.name_ar), (nearest.meters / 1000).toFixed(1))}
          </p>
        )}
      </div>
    </li>
  );
}
