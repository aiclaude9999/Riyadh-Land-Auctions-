'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import MeetupMap from './MeetupMap';
import PeoplePanel from './PeoplePanel';
import PrefsPanel from './PrefsPanel';
import ResultsList from './ResultsList';
import TripOptions, { type TripState } from './TripOptions';
import type { RouteState } from './TripDetails';
import type { MetroLineCollection } from './MetroLayer';
import type { CarRoute } from '@/lib/directions';
import { districtAt, shortEn, type District } from '@/lib/districts';
import { t } from '@/lib/i18n';
import { toStations, type StationCollection } from '@/lib/metro';
import type { Overlay } from '@/lib/overlays';
import { displayName, initialPeopleState, isReady, peopleReducer, personColor, type Person } from '@/lib/people';
import type { RecommendError, RecommendRequest, RecommendResponse } from '@/lib/recommendTypes';
import { usePrefs } from '@/lib/usePrefs';

interface SearchResult {
  response: RecommendResponse;
  people: Person[];
  signature: string;
}

type Tab = 'people' | 'results' | 'prefs';

function buildRequest(people: Person[], trip: TripState, prefs: RecommendRequest['prefs']): RecommendRequest {
  return {
    people: people.map((p, i) => ({ name: displayName(p, i), mode: p.mode, location: p.location! })),
    venueType: trip.venueType,
    ...(trip.departMode === 'later' && trip.departLocal ? { departAt: new Date(trip.departLocal).toISOString() } : {}),
    prefs,
  };
}

export default function MeetupApp({ stations, lines, districts }: { stations: StationCollection; lines: MetroLineCollection; districts: District[] }) {
  const [state, dispatch] = useReducer(peopleReducer, undefined, initialPeopleState);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [focusDistrict, setFocusDistrict] = useState<District | null>(null);
  const [showMetro, setShowMetro] = useState(true);
  const [trip, setTrip] = useState<TripState>({ venueType: 'both', departMode: 'now', departLocal: '' });
  const [tab, setTab] = useState<Tab>('people');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [carRoutes, setCarRoutes] = useState<Record<string, RouteState>>({});
  const [prefs, updatePrefs] = usePrefs();
  const [names, setNames] = useState<Record<string, string>>({});
  const stationList = useMemo(() => toStations(stations), [stations]);

  const ready = isReady(state);
  const signature = ready ? JSON.stringify(buildRequest(state.people, trip, prefs)) : '';
  const stale = !!result && result.signature !== signature;

  // Esc cancels "pick on map"; picking is also dropped if that person is removed.
  useEffect(() => {
    if (!pickingId) return;
    if (!state.people.some((p) => p.id === pickingId)) setPickingId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPickingId(null);
      setFocusDistrict(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingId, state.people]);

  // Car routes for the selected place (loaded on demand, cached here and on the server for 10 min).
  const selected = result?.response.results.find((r) => r.venue.id === selectedId);
  useEffect(() => {
    if (!result || !selected) return;
    for (const e of selected.etas) {
      const from = result.people[e.person]?.location;
      const key = `${e.person}|${selected.venue.id}`;
      if (e.mode !== 'car' || !from || carRoutes[key] !== undefined) continue;
      setCarRoutes((c) => ({ ...c, [key]: 'loading' }));
      const to = selected.venue.location;
      fetch(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`)
        .then((r) => (r.ok ? (r.json() as Promise<CarRoute>) : Promise.reject(new Error(String(r.status)))))
        .then((route) => setCarRoutes((c) => ({ ...c, [key]: route })))
        .catch(() => setCarRoutes((c) => ({ ...c, [key]: 'error' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.venue.id, result]);

  // Lines on the map for the selected place: car routes, metro rides in line colours, walks dashed.
  const overlays = useMemo<Overlay[]>(() => {
    const out: Overlay[] = [];
    if (focusDistrict) out.push({ kind: 'area', rings: focusDistrict.rings, color: '#0f766e' });
    if (!result || !selected || stale) return out;
    for (const e of selected.etas) {
      const color = personColor(e.person);
      const from = result.people[e.person]?.location;
      if (!from) continue;
      if (e.mode === 'car') {
        const route = carRoutes[`${e.person}|${selected.venue.id}`];
        if (route && typeof route === 'object') out.push({ kind: 'line', points: route.path, color, weight: 5, opacity: 0.85 });
        continue;
      }
      const legs = e.detail?.legs ?? [];
      const rides = legs.filter((l) => l.kind === 'ride');
      if (!rides.length) {
        out.push({ kind: 'line', points: [from, selected.venue.location], color, weight: 3, dashed: true });
        continue;
      }
      out.push({ kind: 'line', points: [from, rides[0].path[0]], color, weight: 3, dashed: true });
      for (const r of rides) out.push({ kind: 'line', points: r.path, color: r.color, weight: 7, opacity: 0.9 });
      out.push({ kind: 'line', points: [rides[rides.length - 1].path.at(-1)!, selected.venue.location], color, weight: 3, dashed: true });
    }
    return out;
  }, [focusDistrict, result, selected, stale, carRoutes]);

  async function find() {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    setPickingId(null);
    setFocusDistrict(null);
    try {
      const res = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: signature });
      const data = (await res.json()) as RecommendResponse | RecommendError;
      if (!res.ok || 'error' in data) {
        setError('error' in data && data.error === 'bad_request' ? data.message : t.requestFailed);
        return;
      }
      setResult({ response: data, people: state.people, signature });
      setNames((n) => ({ ...n, ...Object.fromEntries(data.results.map((r) => [r.venue.id, r.venue.name])) }));
      setSelectedId(data.results[0]?.venue.id ?? null);
      setTab('results');
    } catch {
      setError(t.requestFailed);
    } finally {
      setLoading(false);
    }
  }

  function chooseDistrict(personId: string, d: District) {
    dispatch({ type: 'setLocation', id: personId, location: d.center, address: t.districtCentre(shortEn(d)), source: 'district' });
    setFocusDistrict(d);
    setPickingId(personId); // next tap on the map refines the spot
  }

  const pickingIndex = state.people.findIndex((p) => p.id === pickingId);
  const pickingName = pickingIndex >= 0 ? displayName(state.people[pickingIndex], pickingIndex) : null;
  const readyCount = state.people.filter((p) => p.location).length;
  const tabClass = (active: boolean) => `flex-1 border-b-2 px-2 py-2 text-sm font-medium ${active ? 'border-brand text-brand-dark' : 'border-transparent text-slate-500 hover:text-slate-700'}`;

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <header className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <h1 className="text-base font-semibold text-brand-dark">{t.appTitle}</h1>
      </header>
      <aside className="order-2 flex min-h-0 flex-1 flex-col border-slate-200 bg-white md:order-1 md:w-[420px] md:flex-none md:border-e">
        <header className="hidden border-b border-slate-200 px-4 py-3 md:block">
          <h1 className="text-lg font-semibold text-brand-dark">{t.appTitle}</h1>
          <p className="text-sm text-slate-500">{t.appTagline}</p>
        </header>

        <div role="tablist" className="flex border-b border-slate-200">
          <button type="button" role="tab" aria-selected={tab === 'people'} className={tabClass(tab === 'people')} onClick={() => setTab('people')}>
            {t.tabPeople} ({state.people.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'results'} disabled={!result} className={`${tabClass(tab === 'results')} disabled:opacity-40`} onClick={() => setTab('results')}>
            {t.tabResults}
            {result ? ` (${result.response.results.length})` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'prefs'} className={tabClass(tab === 'prefs')} onClick={() => setTab('prefs')}>
            {t.tabPrefs}
          </button>
        </div>

        {tab === 'results' && result ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ResultsList
              response={result.response}
              people={result.people}
              stale={stale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              carRoutes={carRoutes}
              prefs={prefs}
              onToggleFavourite={(id) => updatePrefs((p) => ({ ...p, favourites: p.favourites.includes(id) ? p.favourites.filter((x) => x !== id) : [...p.favourites, id] }))}
              onHide={(id) => updatePrefs((p) => ({ ...p, hidden: [...p.hidden, id], favourites: p.favourites.filter((x) => x !== id) }))}
            />
          </div>
        ) : tab === 'prefs' ? (
          <PrefsPanel prefs={prefs} update={updatePrefs} names={names} />
        ) : (
          <PeoplePanel
            state={state}
            dispatch={dispatch}
            stations={stationList}
            pickingId={pickingId}
            onPick={(id) => {
              setFocusDistrict(null);
              setPickingId((cur) => (cur === id ? null : id));
            }}
            districts={districts}
            onDistrict={chooseDistrict}
          />
        )}

        <footer className="space-y-2 border-t border-slate-200 px-4 py-3">
          <TripOptions trip={trip} onChange={setTrip} />
          {trip.departMode === 'later' && result?.response.meta.dataSource !== 'google' && <p className="text-xs text-slate-400">{t.noTrafficLater}</p>}
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
            const d = districtAt(location, districts);
            dispatch({ type: 'setLocation', id: pickingId, location, address: d ? t.pinnedIn(shortEn(d)) : null, source: 'pin' });
            setPickingId(null);
            setFocusDistrict(null);
          }}
          onDragPerson={(id, location) => {
            const d = districtAt(location, districts);
            dispatch({ type: 'setLocation', id, location, address: d ? t.pinnedIn(shortEn(d)) : null, source: 'pin' });
          }}
          results={stale ? [] : (result?.response.results ?? [])}
          resultsKey={result?.signature ?? ''}
          selectedVenueId={selectedId}
          onSelectVenue={(id) => {
            setSelectedId(id);
            setTab('results');
          }}
          overlays={overlays}
          focusBounds={focusDistrict?.rings ?? null}
        />
        {pickingName && (
          <div className="pointer-events-auto absolute inset-x-0 top-3 z-[1100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
            <span>{focusDistrict ? t.refineBanner(pickingName, shortEn(focusDistrict)) : t.pickBanner(pickingName)}</span>
            <button
              type="button"
              className="shrink-0 rounded-full bg-white/15 px-3 py-0.5 hover:bg-white/25"
              onClick={() => {
                setPickingId(null);
                setFocusDistrict(null);
              }}
            >
              {focusDistrict ? 'OK' : t.cancel}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
