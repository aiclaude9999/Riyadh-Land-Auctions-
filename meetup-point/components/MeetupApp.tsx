'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import MeetupMap from './MeetupMap';
import PeoplePanel from './PeoplePanel';
import type { MetroLineCollection } from './MetroLayer';
import { t } from '@/lib/i18n';
import { toStations, type StationCollection } from '@/lib/metro';
import { displayName, initialPeopleState, peopleReducer } from '@/lib/people';

export default function MeetupApp({ stations, lines }: { stations: StationCollection; lines: MetroLineCollection }) {
  const [state, dispatch] = useReducer(peopleReducer, undefined, initialPeopleState);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [showMetro, setShowMetro] = useState(true);
  const stationList = useMemo(() => toStations(stations), [stations]);

  // Esc cancels "pick on map"; picking is also dropped if that person is removed.
  useEffect(() => {
    if (!pickingId) return;
    if (!state.people.some((p) => p.id === pickingId)) setPickingId(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickingId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingId, state.people]);

  const pickingIndex = state.people.findIndex((p) => p.id === pickingId);
  const pickingName = pickingIndex >= 0 ? displayName(state.people[pickingIndex], pickingIndex) : null;

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <header className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <h1 className="text-base font-semibold text-brand-dark">{t.appTitle}</h1>
      </header>
      <aside className="order-2 flex min-h-0 flex-1 flex-col border-slate-200 bg-white md:order-1 md:w-[400px] md:flex-none md:border-e">
        <header className="hidden border-b border-slate-200 px-4 py-3 md:block">
          <h1 className="text-lg font-semibold text-brand-dark">{t.appTitle}</h1>
          <p className="text-sm text-slate-500">{t.appTagline}</p>
        </header>
        <PeoplePanel
          state={state}
          dispatch={dispatch}
          stations={stationList}
          pickingId={pickingId}
          onPick={(id) => setPickingId((cur) => (cur === id ? null : id))}
        />
      </aside>

      <main className="relative order-1 h-[45dvh] md:order-2 md:h-auto md:flex-1">
        <MeetupMap
          people={state.people}
          stationsGeoJson={stations}
          linesGeoJson={lines}
          showMetro={showMetro}
          onToggleMetro={() => setShowMetro((v) => !v)}
          pickingId={pickingId}
          onMapPick={(location) => {
            if (!pickingId) return;
            dispatch({ type: 'setLocation', id: pickingId, location, address: null, source: 'pin' });
            setPickingId(null);
          }}
          onDragPerson={(id, location) => dispatch({ type: 'setLocation', id, location, address: null, source: 'pin' })}
        />
        {pickingName && (
          <div className="pointer-events-auto absolute inset-x-0 top-3 z-10 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
            <span>{t.pickBanner(pickingName)}</span>
            <button type="button" className="rounded-full bg-white/15 px-3 py-0.5 hover:bg-white/25" onClick={() => setPickingId(null)}>
              {t.cancel}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
