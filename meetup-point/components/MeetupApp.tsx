'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import MeetupMap from './MeetupMap';
import PeoplePanel from './PeoplePanel';
import ResultsList from './ResultsList';
import TripOptions, { type TripState } from './TripOptions';
import type { MetroLineCollection } from './MetroLayer';
import { t } from '@/lib/i18n';
import { toStations, type StationCollection } from '@/lib/metro';
import { displayName, initialPeopleState, isReady, peopleReducer, type Person } from '@/lib/people';
import type { RecommendError, RecommendRequest, RecommendResponse } from '@/lib/recommendTypes';

interface SearchResult {
  response: RecommendResponse;
  people: Person[];
  signature: string;
}

function buildRequest(people: Person[], trip: TripState): RecommendRequest {
  return {
    people: people.map((p, i) => ({ name: displayName(p, i), mode: p.mode, location: p.location! })),
    venueType: trip.venueType,
    ...(trip.departMode === 'later' && trip.departLocal ? { departAt: new Date(trip.departLocal).toISOString() } : {}),
  };
}

export default function MeetupApp({ stations, lines }: { stations: StationCollection; lines: MetroLineCollection }) {
  const [state, dispatch] = useReducer(peopleReducer, undefined, initialPeopleState);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [showMetro, setShowMetro] = useState(true);
  const [trip, setTrip] = useState<TripState>({ venueType: 'both', departMode: 'now', departLocal: '' });
  const [tab, setTab] = useState<'people' | 'results'>('people');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stationList = useMemo(() => toStations(stations), [stations]);

  const ready = isReady(state);
  const signature = ready ? JSON.stringify(buildRequest(state.people, trip)) : '';
  const stale = !!result && result.signature !== signature;

  // Esc cancels "pick on map"; picking is also dropped if that person is removed.
  useEffect(() => {
    if (!pickingId) return;
    if (!state.people.some((p) => p.id === pickingId)) setPickingId(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickingId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingId, state.people]);

  async function find() {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    setPickingId(null);
    try {
      const res = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: signature });
      const data = (await res.json()) as RecommendResponse | RecommendError;
      if (!res.ok || 'error' in data) {
        setError('error' in data && data.error === 'bad_request' ? data.message : t.requestFailed);
        return;
      }
      setResult({ response: data, people: state.people, signature });
      setSelectedId(data.results[0]?.venue.id ?? null);
      setTab('results');
    } catch {
      setError(t.requestFailed);
    } finally {
      setLoading(false);
    }
  }

  const pickingIndex = state.people.findIndex((p) => p.id === pickingId);
  const pickingName = pickingIndex >= 0 ? displayName(state.people[pickingIndex], pickingIndex) : null;
  const readyCount = state.people.filter((p) => p.location).length;
  const tabClass = (active: boolean) => `flex-1 border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-brand text-brand-dark' : 'border-transparent text-slate-500 hover:text-slate-700'}`;

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

        {result && (
          <div role="tablist" className="flex border-b border-slate-200">
            <button type="button" role="tab" aria-selected={tab === 'people'} className={tabClass(tab === 'people')} onClick={() => setTab('people')}>
              {t.tabPeople} ({state.people.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === 'results'} className={tabClass(tab === 'results')} onClick={() => setTab('results')}>
              {t.tabResults} ({result.response.results.length})
            </button>
          </div>
        )}

        {tab === 'results' && result ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ResultsList response={result.response} people={result.people} stale={stale} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        ) : (
          <PeoplePanel
            state={state}
            dispatch={dispatch}
            stations={stationList}
            pickingId={pickingId}
            onPick={(id) => setPickingId((cur) => (cur === id ? null : id))}
          />
        )}

        <footer className="space-y-2 border-t border-slate-200 px-4 py-3">
          <TripOptions trip={trip} onChange={setTrip} />
          {trip.departMode === 'later' && !result?.response.meta.dataSource.startsWith('google') && <p className="text-xs text-slate-400">{t.noTrafficLater}</p>}
          <button
            type="button"
            onClick={find}
            disabled={!ready || loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? t.finding : t.find}
          </button>
          <p className={`text-xs ${ready ? 'text-slate-500' : 'text-amber-700'}`}>{ready ? t.readyCount(readyCount, state.people.length) : t.needLocations}</p>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </footer>
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
          results={result?.response.results ?? []}
          resultsKey={result?.signature ?? ''}
          selectedVenueId={selectedId}
          onSelectVenue={(id) => {
            setSelectedId(id);
            setTab('results');
          }}
        />
        {pickingName && (
          <div className="pointer-events-auto absolute inset-x-0 top-3 z-[1100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
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
