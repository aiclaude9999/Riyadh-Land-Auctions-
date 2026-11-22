'use client';

import type { Dispatch } from 'react';
import NeighbourhoodPicker from './NeighbourhoodPicker';
import PlaceSearch from './PlaceSearch';
import type { District } from '@/lib/districts';
import { useName, useT } from './LocaleProvider';
import { shortAr, shortEn } from '@/lib/districts';
import { Car, Footprints, LocateFixed, MapPin, MousePointerClick, TrainFront } from 'lucide-react';
import { useState } from 'react';
import { districtAt } from '@/lib/districts';
import type { PlaceHit } from '@/lib/places';
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
  onPlace: (hit: PlaceHit) => void;
  /** shared group: someone else's entry */
  readOnly?: boolean;
}

// Google address search needs the paid Google key; without it the free neighbourhood list is used.
const HAS_GOOGLE = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;


export default function PersonCard({ person, index, canRemove, dispatch, stations, picking, onPick, districts, onPlace, readOnly = false }: Props) {
  const t = useT();
  const n = useName();
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);
  // "My location": the phone's GPS (needs permission; works on https or localhost)
  function locateMe() {
    if (!navigator.geolocation) return setLocError(true);
    setLocating(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        dispatch({ type: 'setLocation', id: person.id, location, address: t.myLocation, source: 'search', districtId: districtAt(location, districts)?.id ?? null });
        setLocating(false);
        setEditing(false);
      },
      () => {
        setLocating(false);
        setLocError(true);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }
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
        {person.location && !editing ? (
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-sand px-2.5 py-2 text-sm">
            <MapPin size={16} className="shrink-0 text-brand" aria-hidden />
            <p className="min-w-0 flex-1 truncate">{label}</p>
            {!readOnly && (
              <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg px-2 font-medium text-brand hover:bg-brand-light">
                {t.changeLocation}
              </button>
            )}
          </div>
        ) : readOnly ? (
          <p className="mt-1 text-xs text-ink-soft">{t.missingLocation}</p>
        ) : (
          <div className="mt-1 space-y-2">
            {HAS_GOOGLE ? (
              <PlaceSearch
                onSelect={(place) => {
                  dispatch({ type: 'setLocation', id: person.id, location: place.location, address: place.label, source: 'search' });
                  setEditing(false);
                }}
              />
            ) : (
              <NeighbourhoodPicker
                autoFocus={editing}
                districts={districts}
                onSelect={(hit) => {
                  onPlace(hit);
                  setEditing(false);
                }}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={locateMe} disabled={locating} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sand-dark bg-white px-3 text-sm text-ink hover:border-brand">
                <LocateFixed size={16} aria-hidden /> {locating ? t.locating : t.myLocation}
              </button>
              <button
                type="button"
                onClick={() => {
                  onPick();
                  setEditing(false);
                }}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm ${picking ? 'border-brand bg-brand text-white' : 'border-sand-dark bg-white text-ink hover:border-brand'}`}
              >
                <MousePointerClick size={16} aria-hidden /> {picking ? t.picking : t.pickOnMap}
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-3 text-sm text-ink-soft hover:bg-sand">
                  {t.cancel}
                </button>
              )}
            </div>
            {locError && <p className="text-xs text-amber-700">{t.locationDenied}</p>}
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
