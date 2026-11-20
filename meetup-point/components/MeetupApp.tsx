'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { venueGroups, type CuisineGroup } from '@/lib/cuisine';
import { fromCompact, type CompactVenue } from '@/lib/venueLayer';
import { matchesType, type Venue } from '@/lib/venues';
import MeetupMap from './MeetupMap';
import PeoplePanel from './PeoplePanel';
import PrefsPanel from './PrefsPanel';
import ResultsList from './ResultsList';
import SharePanel from './SharePanel';
import { fromWire } from '@/lib/groupClient';
import { useGroup } from '@/lib/useGroup';
import { fairnessWeights, loadHistory, saveHistory, type Meetup } from '@/lib/history';
import { riyadhClock } from '@/lib/timing';
import type { Style } from '@/lib/matching';
import { orderedResults } from '@/lib/styleOrder';
import TripOptions, { departDate, initialTrip, type TripState } from './TripOptions';
import type { RouteState } from './TripDetails';
import type { MetroLineCollection } from './MetroLayer';
import type { CarRoute } from '@/lib/directions';
import { buildTrack } from '@/lib/metroTrack';
import { buildPieces, routeRequests, type RoutePiece } from '@/lib/routePieces';
import { googleDirectionsUrl } from '@/lib/directions';
import { districtAt, shortAr, shortEn, type District } from '@/lib/districts';
import { useLocale, useName, useT } from './LocaleProvider';
import { toStations, type StationCollection } from '@/lib/metro';
import type { FitTarget, Overlay } from '@/lib/overlays';
import { displayName, initialPeopleState, isReady, peopleReducer, personColor, type Person } from '@/lib/people';
import type { RecommendError, RecommendRequest, RecommendResponse } from '@/lib/recommendTypes';
import { usePrefs } from '@/lib/usePrefs';

/** Switches English ⇄ Arabic (remembered in a cookie). */
function LangButton() {
  const { locale, t, setLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      lang={locale === 'ar' ? 'en' : 'ar'}
      className="shrink-0 rounded-full border border-slate-300 px-3 py-0.5 text-sm text-slate-700 hover:border-brand hover:text-brand"
    >
      {t.switchTo}
    </button>
  );
}

interface SearchResult {
  response: RecommendResponse;
  people: Person[];
  signature: string;
}

type Tab = 'people' | 'results' | 'prefs';

function buildRequest(people: Person[], trip: TripState, prefs: RecommendRequest['prefs'], weights?: number[]): RecommendRequest {
  return {
    people: people.map((p, i) => ({ name: displayName(p, i), mode: p.mode, location: p.location!, access: p.mode === 'metro' ? (p.access ?? 'walk') : undefined, likes: p.likes as CuisineGroup[] | undefined, avoids: p.avoids as CuisineGroup[] | undefined })),
    venueType: trip.venueType,
    ...(trip.departMode === 'later' ? { departAt: departDate(trip)!.toISOString() } : {}),
    prefs,
    filters: { nearMetro: trip.nearMetro, food: trip.food },
    ...(trip.ramadan ? { ramadan: true } : {}),
    ...(weights && weights.some((w) => w !== 1) ? { weights } : {}),
  };
}

export default function MeetupApp({ stations, lines, districts }: { stations: StationCollection; lines: MetroLineCollection; districts: District[] }) {
  const t = useT();
  const n = useName();
  const { locale } = useLocale();
  const [state, dispatch] = useReducer(peopleReducer, undefined, initialPeopleState);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [focusDistrict, setFocusDistrict] = useState<District | null>(null);
  const [showMetro, setShowMetro] = useState(true);
  const [trip, setTrip] = useState<TripState>(() => initialTrip());
  const [zoneOn, setZoneOn] = useState(false);
  const [zoneMin, setZoneMin] = useState(30);
  const [tab, setTab] = useState<Tab>('people');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteState>>({});
  const [focusPerson, setFocusPerson] = useState<number | null>(null);
  const [fitTo, setFitTo] = useState<FitTarget | null>(null);
  const [showAllVenues, setShowAllVenues] = useState(false);
  const [venuesAll, setVenuesAll] = useState<Venue[] | null>(null);
  const [style, setStyle] = useState<Style>('fair');
  const [prefs, updatePrefs] = usePrefs();
  const [names, setNames] = useState<Record<string, string>>({});
  const stationList = useMemo(() => toStations(stations), [stations]);
  const group = useGroup(state, dispatch);
  const act = group.act; // every people change goes through the group sync when sharing
  const lastSearchSig = useRef('');
  const seenResultsAt = useRef<string | null | undefined>(undefined);

  const ready = isReady(state);
  // fairness over time: weights from past meetups (by name)
  const [history, setHistory] = useState<Meetup[]>([]);
  useEffect(() => setHistory(loadHistory()), []);
  const weights = useMemo(() => fairnessWeights(state.people.map((p, i) => displayName(p, i)), history), [state.people, history]);
  const signature = ready ? JSON.stringify(buildRequest(state.people, trip, prefs, weights)) : '';
  const [pendingFind, setPendingFind] = useState(false);
  const [reachOn, setReachOn] = useState(false);
  // shared group: friends cannot re-run the search, so their results are never "stale"
  const stale = !!result && (!group.id || group.isAdmin) && result.signature !== signature;

  // shared group: results arrive with the group (organiser's search, or polling for everyone else)
  useEffect(() => {
    const v = group.view;
    if (!v) return;
    const first = seenResultsAt.current === undefined;
    if (v.resultsAt === seenResultsAt.current) return;
    seenResultsAt.current = v.resultsAt;
    if (!v.results) return;
    setResult({ response: v.results, people: v.people.map(fromWire), signature: group.isAdmin ? lastSearchSig.current || signature : '' });
    setNames((old) => ({ ...old, ...Object.fromEntries(v.results!.results.map((r) => [r.venue.id, n(r.venue.name, r.venue.nameAr)])) }));
    setSelectedId(v.results.results[0]?.venue.id ?? null);
    if (v.results.results[0]) setZoneMin(Math.max(10, Math.ceil(v.results.results[0].maxEta / 5) * 5));
    if (!first || group.isAdmin) setTab('results');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.view?.resultsAt]);

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

  // Routes for the selected place, loaded on demand (cached here and on the server for 10 min):
  // car = road route; metro = walking legs along the streets (rides follow the metro track).
  const selected = result?.response.results.find((r) => r.venue.id === selectedId);
  // switching ranking style selects that style's first place
  useEffect(() => {
    if (!result) return;
    const first = orderedResults(result.response, style)[0];
    if (first) setSelectedId(first.venue.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);
  const tracks = useMemo(() => new Map(lines.features.map((f) => [f.properties.ref, buildTrack(f)] as const)), [lines]);
  const neededRoutes = useMemo(() => (result && selected ? routeRequests(selected, result.people) : []), [result, selected]);
  useEffect(() => {
    for (const r of neededRoutes) {
      if (routes[r.key] !== undefined) continue;
      setRoutes((c) => ({ ...c, [r.key]: 'loading' }));
      fetch(`/api/route?from=${r.from.lat},${r.from.lng}&to=${r.to.lat},${r.to.lng}&mode=${r.mode}`)
        .then((res) => (res.ok ? (res.json() as Promise<CarRoute>) : Promise.reject(new Error(String(res.status)))))
        .then((route) => setRoutes((c) => ({ ...c, [r.key]: route })))
        .catch(() => setRoutes((c) => ({ ...c, [r.key]: 'error' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededRoutes]);

  // a new place or new results → show everyone again
  useEffect(() => setFocusPerson(null), [selectedId, result]);

  // Each person's route to the selected place as map pieces.
  const personPieces = useMemo(() => {
    if (!result || !selected || stale) return new Map<number, RoutePiece[]>();
    return new Map(selected.etas.map((e) => [e.person, buildPieces(e, result.people[e.person]?.location ?? null, selected.venue.location, routes, tracks)] as const));
  }, [result, selected, stale, routes, tracks]);

  const overlays = useMemo<Overlay[]>(() => {
    const out: Overlay[] = [];
    if (focusDistrict) out.push({ kind: 'area', rings: focusDistrict.rings, color: '#0f766e' });
    const zone = result?.response.zone;
    if (reachOn && zone && !stale) {
      // each person's reach in their colour; overlaps look darker = good meeting area
      result!.people.forEach((_, pi) => {
        for (const c of zone.cells) {
          if ((c.per?.[pi] ?? Infinity) > zoneMin) continue;
          out.push({ kind: 'cell', south: c.lat - zone.cellLat / 2, north: c.lat + zone.cellLat / 2, west: c.lng - zone.cellLng / 2, east: c.lng + zone.cellLng / 2, color: personColor(pi), opacity: 0.16 });
        }
      });
    }
    if (zoneOn && zone && !stale) {
      for (const c of zone.cells) {
        if (c.maxEta > zoneMin) continue;
        out.push({ kind: 'cell', south: c.lat - zone.cellLat / 2, north: c.lat + zone.cellLat / 2, west: c.lng - zone.cellLng / 2, east: c.lng + zone.cellLng / 2, color: '#059669', opacity: 0.22 + 0.23 * (1 - c.maxEta / Math.max(zoneMin, 1)) });
      }
    }
    for (const [person, pieces] of personPieces) {
      if (focusPerson !== null && person !== focusPerson) continue;
      const focused = focusPerson === person;
      for (const p of pieces) {
        if (p.kind === 'stop') {
          if (focused) out.push({ kind: 'dot', at: p.at, color: p.color, label: n(p.name, p.nameAr) });
          continue;
        }
        const weight = p.kind === 'ride' ? (focused ? 8 : 6) : p.kind === 'walk' ? (focused ? 5 : 3) : focused ? 7 : 5;
        out.push({ kind: 'line', points: p.points, color: p.color, weight, dashed: p.kind === 'walk' || p.rough, opacity: focused ? 1 : 0.85, outline: focused && p.kind !== 'walk' });
      }
    }
    return out;
  }, [focusDistrict, result, stale, zoneOn, zoneMin, reachOn, personPieces, focusPerson, n]);

  function showRoute(person: number) {
    const pts = (personPieces.get(person) ?? []).flatMap((p) => (p.kind === 'stop' ? [p.at] : p.points));
    setFocusPerson(person);
    if (pts.length) setFitTo({ points: pts, key: `route-${person}-${Date.now()}` });
  }

  // "All cafés & restaurants" layer: loaded once when first switched on, then filtered like the search
  useEffect(() => {
    if (!showAllVenues || venuesAll) return;
    fetch('/api/venues')
      .then((r) => r.json() as Promise<CompactVenue[]>)
      .then((rows) => setVenuesAll(rows.map(fromCompact)))
      .catch(() => setError(t.requestFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllVenues]);
  const visibleVenues = useMemo(
    () => venuesAll?.filter((v) => matchesType(v, trip.venueType) && (!trip.food || venueGroups(v).includes(trip.food)) && !prefs.hidden.includes(v.id)) ?? null,
    [venuesAll, trip.venueType, trip.food, prefs.hidden],
  );

  /** "Use as meeting place": everyone's trip to a place tapped on the map; shown first as ★ "Your pick". */
  const pickVenue = useCallback(
    async (v: Venue) => {
      if (!ready) {
        setError(t.pickNeedsPeople);
        setTab('people');
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const body = { ...(JSON.parse(signature) as RecommendRequest), venueIds: [v.id] };
        const res = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = (await res.json()) as RecommendResponse | RecommendError;
        if (!res.ok || 'error' in data || !data.results[0]) {
          setError(t.requestFailed);
          return;
        }
        const pick = { ...data.results[0], rank: 0 };
        setResult((prev) => {
          const keep = prev && prev.signature === signature ? prev : null;
          const others = keep ? keep.response.results.filter((r) => r.rank !== 0 && r.venue.id !== v.id) : [];
          return { response: { ...(keep?.response ?? data), results: [pick, ...others] }, people: state.people, signature };
        });
        setNames((old) => ({ ...old, [v.id]: n(v.name, v.nameAr) }));
        setSelectedId(v.id);
        setTab('results');
      } catch {
        setError(t.requestFailed);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, signature, state.people, t, n],
  );

  // "use this time" from the best-time strip: switch to that departure and search again
  useEffect(() => {
    if (!pendingFind) return;
    setPendingFind(false);
    void find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, pendingFind]);
  function applyTime(iso: string) {
    const d = new Date(iso);
    const c = riyadhClock(d);
    const today = riyadhClock(new Date());
    const dayOffset = (c.day - today.day + 7) % 7;
    setTrip((tr) => ({ ...tr, departMode: 'later', departDay: dayOffset, departMinutes: Math.round(c.minutes / 30) * 30 }));
    setPendingFind(true);
  }

  /** "We are going here": remember the trip times for fairness next time and for real-time reports. */
  function weGo(venueId: string) {
    const r = result?.response.results.find((x) => x.venue.id === venueId);
    if (!r || !result) return;
    const entry: Meetup = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      venue: n(r.venue.name, r.venue.nameAr),
      people: r.etas.map((e) => ({ name: displayName(result.people[e.person], e.person), mode: e.mode, minutes: Math.round(e.minutes) })),
    };
    const next = [...history, entry];
    setHistory(next);
    saveHistory(next);
  }

  async function find() {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    setPickingId(null);
    setFocusDistrict(null);
    if (group.id) {
      // organiser: the server searches with the group's saved people and shares the result
      try {
        const { people: _p, ...options } = JSON.parse(signature) as RecommendRequest;
        lastSearchSig.current = signature;
        await group.search(options);
      } catch {
        setError(t.requestFailed);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const res = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: signature });
      const data = (await res.json()) as RecommendResponse | RecommendError;
      if (!res.ok || 'error' in data) {
        setError('error' in data && data.error === 'bad_request' ? data.message : t.requestFailed);
        return;
      }
      setResult({ response: data, people: state.people, signature });
      setNames((old) => ({ ...old, ...Object.fromEntries(data.results.map((r) => [r.venue.id, n(r.venue.name, r.venue.nameAr)])) }));
      setSelectedId(data.results[0]?.venue.id ?? null);
      // start the zone slider at the best place's longest trip, rounded up to 5 min
      if (data.results[0]) setZoneMin(Math.max(10, Math.ceil(data.results[0].maxEta / 5) * 5));
      setTab('results');
    } catch {
      setError(t.requestFailed);
    } finally {
      setLoading(false);
    }
  }

  function chooseDistrict(personId: string, d: District) {
    act({ type: 'setLocation', id: personId, location: d.center, address: null, source: 'district', districtId: d.id });
    setFocusDistrict(d);
    setFitTo({ points: d.rings.flat().map(([lat, lng]) => ({ lat, lng })), key: `district-${d.id}-${Date.now()}` });
    setPickingId(personId); // next tap on the map refines the spot
  }

  const pickingIndex = state.people.findIndex((p) => p.id === pickingId);
  const pickingName = pickingIndex >= 0 ? displayName(state.people[pickingIndex], pickingIndex, t.namePlaceholder) : null;
  const readyCount = state.people.filter((p) => p.location).length;
  const tabClass = (active: boolean) => `flex-1 border-b-2 px-2 py-2 text-sm font-medium ${active ? 'border-brand text-brand-dark' : 'border-transparent text-slate-500 hover:text-slate-700'}`;

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <h1 className="text-base font-semibold text-brand-dark">{t.appTitle}</h1>
        <LangButton />
      </header>
      <aside className="order-2 flex min-h-0 flex-1 flex-col border-slate-200 bg-white md:order-1 md:w-[420px] md:flex-none md:border-e">
        <header className="hidden border-b border-slate-200 px-4 py-3 md:block">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold text-brand-dark">{t.appTitle}</h1>
            <LangButton />
          </div>
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
            {result.response.zone && !stale && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={zoneOn} onChange={(e) => setZoneOn(e.target.checked)} className="accent-emerald-600" />
                  <span>
                    {t.zoneToggle} <strong className="tabular-nums">{t.minutes(zoneMin)}</strong>
                  </span>
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={reachOn} onChange={(e) => setReachOn(e.target.checked)} className="accent-emerald-600" />
                  <span>{t.reachToggle}</span>
                </label>
                {reachOn && <p className="text-xs text-slate-500">{t.reachLegend}</p>}
                {(zoneOn || reachOn) && (
                  <>
                    <input type="range" min={10} max={90} step={5} value={zoneMin} onChange={(e) => setZoneMin(Number(e.target.value))} aria-label={t.zoneToggle} className="mt-1 w-full accent-emerald-600" />
                    <p className="text-xs text-slate-500">{t.zoneLegend}</p>
                  </>
                )}
              </div>
            )}
            <ResultsList
              response={result.response}
              people={result.people}
              stale={stale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              routes={routes}
              onShowRoute={showRoute}
              onZoom={(points) => setFitTo({ points, key: `step-${Date.now()}` })}
              prefs={prefs}
              onToggleFavourite={(id) => updatePrefs((p) => ({ ...p, favourites: p.favourites.includes(id) ? p.favourites.filter((x) => x !== id) : [...p.favourites, id] }))}
              onHide={(id) => updatePrefs((p) => ({ ...p, hidden: [...p.hidden, id], favourites: p.favourites.filter((x) => x !== id) }))}
              style={style}
              onStyle={setStyle}
              onUseTime={!group.id || group.isAdmin ? applyTime : undefined}
              onWeGo={weGo}
              savedIds={history.map((h) => h.venue)}
              fairnessNames={state.people.filter((_, i) => (weights[i] ?? 1) > 1.04).map((p) => displayName(p, state.people.indexOf(p), t.namePlaceholder))}
              voting={group.id && group.view ? { counts: group.view.votes, mine: group.myVote, onVote: (v) => void group.vote(v).catch(() => setError(t.requestFailed)) } : undefined}
            />
          </div>
        ) : tab === 'prefs' ? (
          <PrefsPanel prefs={prefs} update={updatePrefs} names={names} history={history} onHistory={(h: Meetup[]) => { setHistory(h); saveHistory(h); }} />
        ) : (
          // share box + people scroll together, so nothing gets squeezed under the controls on phones
          <div className="min-h-0 flex-1 overflow-y-auto">
          <SharePanel group={group} canShare={state.people.length > 0} />
          <PeoplePanel
            state={state}
            dispatch={act}
            stations={stationList}
            pickingId={pickingId}
            onPick={(id) => {
              setFocusDistrict(null);
              setPickingId((cur) => (cur === id ? null : id));
            }}
            districts={districts}
            onDistrict={chooseDistrict}
            canEdit={group.canEdit}
            minPeople={group.id ? 1 : 2}
            {...(group.id
              ? {
                  onAdd: () => void group.join().catch(() => setError(t.requestFailed)),
                  addLabel: group.isAdmin || Object.keys(group.creds?.people ?? {}).length ? t.addPerson : t.addMe,
                }
              : {})}
          />
          </div>
        )}

        <footer className="space-y-2 border-t border-slate-200 px-4 py-3">
          {(!group.id || group.isAdmin) && <TripOptions trip={trip} onChange={setTrip} />}
          {group.id && !group.isAdmin && <p className="text-xs text-slate-500">{t.onlyOrganiserSearches}</p>}
          <button
            type="button"
            onClick={find}
            disabled={!ready || loading || (!!group.id && !group.isAdmin)}
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
            act({ type: 'setLocation', id: pickingId, location, address: null, source: 'pin', districtId: d?.id ?? null });
            setPickingId(null);
            setFocusDistrict(null);
          }}
          onDragPerson={(id, location) => {
            const d = districtAt(location, districts);
            if (!group.canEdit(id)) return;
            act({ type: 'setLocation', id, location, address: null, source: 'pin', districtId: d?.id ?? null });
          }}
          results={stale || !result ? [] : orderedResults(result.response, style)}
          resultsKey={result?.signature ?? ''}
          selectedVenueId={selectedId}
          onSelectVenue={(id) => {
            setSelectedId(id);
            setTab('results');
          }}
          overlays={overlays}
          fitTo={fitTo}
          allVenues={visibleVenues}
          showAllVenues={showAllVenues}
          onToggleAllVenues={() => setShowAllVenues((s) => !s)}
          onPickVenue={!group.id || group.isAdmin ? pickVenue : undefined}
        />
        {focusPerson !== null && result && selected && (() => {
          const e = selected.etas.find((x) => x.person === focusPerson);
          const who = result.people[focusPerson];
          if (!e || !who?.location) return null;
          const car = routes[routeRequests(selected, result.people).find((r) => r.person === focusPerson && r.mode === 'car')?.key ?? ''];
          return (
            <div className="absolute inset-x-3 bottom-10 z-[1100] mx-auto flex max-w-md items-center gap-3 rounded-xl bg-white/95 p-3 shadow-lg">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: personColor(focusPerson) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {e.mode === 'metro' ? '🚇' : '🚗'} {t.routeOf(displayName(who, focusPerson, t.namePlaceholder))} → {n(selected.venue.name, selected.venue.nameAr)}
                </p>
                <p className="text-xs text-slate-500">
                  {t.minutes(e.minutes)}
                  {car && typeof car === 'object' ? ` · ${t.distance(car.km * 1000)}` : ''}
                </p>
              </div>
              <a href={googleDirectionsUrl(who.location, selected.venue.location, e.mode)} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs hover:border-brand">
                🧭 {t.directions}
              </a>
              <button type="button" onClick={() => setFocusPerson(null)} className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                {t.showEveryone}
              </button>
            </div>
          );
        })()}
        {pickingName && (
          <div className="pointer-events-auto absolute inset-x-0 top-3 z-[1100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
            <span>{focusDistrict ? t.refineBanner(pickingName, n(shortEn(focusDistrict), shortAr(focusDistrict))) : t.pickBanner(pickingName)}</span>
            <button
              type="button"
              className="shrink-0 rounded-full bg-white/15 px-3 py-0.5 hover:bg-white/25"
              onClick={() => {
                setPickingId(null);
                setFocusDistrict(null);
              }}
            >
              {focusDistrict ? (locale === 'ar' ? 'تم' : 'OK') : t.cancel}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
