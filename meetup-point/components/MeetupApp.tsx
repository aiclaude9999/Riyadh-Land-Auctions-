'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { venueGroups, type CuisineGroup } from '@/lib/cuisine';
import { fromCompact, type CompactVenue } from '@/lib/venueLayer';
import { matchesType, type Venue } from '@/lib/venues';
import MeetupMap from './MeetupMap';
import PeoplePanel from './PeoplePanel';
import PrefsPanel from './PrefsPanel';
import ResultsList from './ResultsList';
import ClubMark from './ClubMark';
import BottomSheet, { sheetPx, useIsMobile, type Snap } from './BottomSheet';
import InstallButton from './InstallButton';
import Logo from './Logo';
import { ArrowLeft, ArrowRight, Check, Navigation, Pencil, Search, Settings2 } from 'lucide-react';
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
      className="shrink-0 rounded-full border border-sand-dark bg-white px-2.5 py-1 text-xs font-medium text-ink hover:border-brand hover:text-brand"
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

type Tab = 'people' | 'when' | 'results' | 'prefs';

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
  const mobile = useIsMobile();
  const [snap, setSnap] = useState<Snap>('half');
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
      setSnap('half');
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
  const friendOnly = !!group.id && !group.isAdmin;

  // steps: 1 Who → 2 When & what → 3 Results (Preferences from the header)
  const steps: { id: Tab; label: string; enabled: boolean }[] = [
    { id: 'people', label: t.stepWho, enabled: true },
    { id: 'when', label: t.stepWhen, enabled: !friendOnly },
    { id: 'results', label: t.stepResults, enabled: !!result },
  ];

  const top = (
    <div className="shrink-0 px-4 pb-2 pt-1 md:pt-4">
      <div className="flex items-center gap-2">
        <Logo size={mobile ? 28 : 34} />
        <ClubMark size={mobile ? 28 : 34} />
        <div className="min-w-0 flex-1">
          <h1 className={`truncate font-bold text-ink md:text-lg ${mobile ? 'sr-only' : 'text-base'}`}>{t.appTitle}</h1>
          <p className="hidden truncate text-xs text-ink-soft md:block">{t.appTagline}</p>
        </div>
        <InstallButton />
        <button
          type="button"
          aria-label={t.settings}
          aria-pressed={tab === 'prefs'}
          onClick={() => setTab(tab === 'prefs' ? (result ? 'results' : 'people') : 'prefs')}
          className={`rounded-full p-1.5 ${tab === 'prefs' ? 'bg-brand text-white' : 'text-ink-soft hover:bg-sand-dark'}`}
        >
          <Settings2 size={18} aria-hidden />
        </button>
        <LangButton />
      </div>
      <nav aria-label="steps" className="mt-3 grid grid-cols-3 gap-1.5">
        {steps.map((st, i) => {
          const active = tab === st.id;
          const done = steps.findIndex((x) => x.id === tab) > i;
          return (
            <button
              key={st.id}
              type="button"
              disabled={!st.enabled}
              onClick={() => {
                setTab(st.id);
                if (mobile) setSnap(st.id === 'results' ? 'half' : 'full');
              }}
              className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium transition disabled:opacity-40 ${active ? 'bg-brand text-white shadow-card' : done ? 'bg-brand-light text-brand-dark' : 'bg-white text-ink-soft'}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${active ? 'bg-white/20' : 'bg-sand-dark/60'}`}>{done ? <Check size={12} aria-hidden /> : i + 1}</span>
              <span className="truncate">{st.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  const primary = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white shadow-card hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-ink/20';
  const secondary = 'inline-flex items-center justify-center gap-1 rounded-xl border border-sand-dark bg-white px-3 py-3 text-sm font-medium text-ink hover:border-brand';
  const footer = (
    <div className="space-y-1.5">
      {tab === 'people' && (
        <>
          {friendOnly ? (
            <p className="text-xs text-ink-soft">{t.onlyOrganiserSearches}</p>
          ) : (
            <button type="button" disabled={!ready} onClick={() => { setTab('when'); if (mobile) setSnap('full'); }} className={primary + ' w-full'}>
              {t.next} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden />
            </button>
          )}
          {friendOnly && result && (
            <button type="button" onClick={() => { setTab('results'); if (mobile) setSnap('half'); }} className={primary + ' w-full'}>
              {t.stepResults}
            </button>
          )}
          <p className={`text-xs ${ready ? 'text-ink-soft' : 'text-amber-700'}`}>{ready ? t.readyCount(readyCount, state.people.length) : t.needLocations}</p>
        </>
      )}
      {tab === 'when' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab('people')} className={secondary}>
            <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden /> {t.back}
          </button>
          <button type="button" onClick={find} disabled={!ready || loading} className={primary}>
            <Search size={18} aria-hidden /> {loading ? t.finding : t.find}
          </button>
        </div>
      )}
      {tab === 'results' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => { setTab('people'); if (mobile) setSnap('full'); }} className={secondary + (stale && !friendOnly ? '' : ' flex-1')}>
            <Pencil size={15} aria-hidden /> {t.change}
          </button>
          {!friendOnly && stale && (
            <button type="button" onClick={find} disabled={!ready || loading} className={primary}>
              <Search size={18} aria-hidden /> {loading ? t.finding : t.find}
            </button>
          )}
        </div>
      )}
      {tab === 'prefs' && (
        <button type="button" onClick={() => setTab(result ? 'results' : 'people')} className={secondary + ' w-full'}>
          <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden /> {t.back}
        </button>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );

  const body =
    tab === 'results' && result ? (
      <div className="pt-1">
        <ResultsList
          response={result.response}
          people={result.people}
          stale={stale}
          selectedId={selectedId}
          onSelect={setSelectedId}
          routes={routes}
          onShowRoute={(pi) => {
            showRoute(pi);
            if (mobile) setSnap('peek');
          }}
          onZoom={(points) => {
            setFitTo({ points, key: `step-${Date.now()}` });
            if (mobile) setSnap('peek');
          }}
          prefs={prefs}
          onToggleFavourite={(id) => updatePrefs((p) => ({ ...p, favourites: p.favourites.includes(id) ? p.favourites.filter((x) => x !== id) : [...p.favourites, id] }))}
          onHide={(id) => updatePrefs((p) => ({ ...p, hidden: [...p.hidden, id], favourites: p.favourites.filter((x) => x !== id) }))}
          style={style}
          onStyle={setStyle}
          onUseTime={!friendOnly ? applyTime : undefined}
          onWeGo={weGo}
          savedIds={history.map((h) => h.venue)}
          fairnessNames={state.people.filter((_, i) => (weights[i] ?? 1) > 1.04).map((p) => displayName(p, state.people.indexOf(p), t.namePlaceholder))}
          voting={group.id && group.view ? { counts: group.view.votes, mine: group.myVote, onVote: (v) => void group.vote(v).catch(() => setError(t.requestFailed)) } : undefined}
        />
        {result.response.zone && !stale && (
          <div className="mt-4 rounded-2xl border border-sand-dark bg-white p-3 text-sm shadow-card">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={zoneOn} onChange={(e) => setZoneOn(e.target.checked)} className="accent-brand" />
              <span>
                {t.zoneToggle} <strong className="tabular-nums">{t.minutes(zoneMin)}</strong>
              </span>
            </label>
            <label className="mt-1 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={reachOn} onChange={(e) => setReachOn(e.target.checked)} className="accent-brand" />
              <span>{t.reachToggle}</span>
            </label>
            {(zoneOn || reachOn) && (
              <>
                <input type="range" min={10} max={90} step={5} value={zoneMin} onChange={(e) => setZoneMin(Number(e.target.value))} aria-label={t.zoneToggle} className="mt-1 w-full accent-brand" />
                <p className="text-xs text-ink-soft">{reachOn ? t.reachLegend : t.zoneLegend}</p>
              </>
            )}
          </div>
        )}
      </div>
    ) : tab === 'prefs' ? (
      <div className="-mx-4">
        <PrefsPanel prefs={prefs} update={updatePrefs} names={names} history={history} onHistory={(h: Meetup[]) => { setHistory(h); saveHistory(h); }} />
      </div>
    ) : tab === 'when' ? (
      <div className="rounded-2xl border border-sand-dark bg-white p-3 shadow-card">
        <TripOptions trip={trip} onChange={setTrip} />
      </div>
    ) : (
      <div
        className="-mx-4"
        onFocus={(e) => {
          // typing a place on the phone: raise the panel so the suggestions are visible
          if (mobile && e.target.getAttribute('role') === 'combobox') setSnap('full');
        }}
      >
        <p className="px-4 pb-1 text-sm text-ink-soft">{t.howItWorks}</p>
        <PeoplePanel
          state={state}
          dispatch={act}
          stations={stationList}
          pickingId={pickingId}
          onPick={(id) => {
            setFocusDistrict(null);
            setPickingId((cur) => (cur === id ? null : id));
            if (mobile) setSnap('peek');
          }}
          districts={districts}
          onPlace={(pid, hit) => {
            if (hit.type === 'district') chooseDistrict(pid, hit.district);
            else {
              // a landmark or well-known area: put the pin there and show it
              act({ type: 'setLocation', id: pid, location: hit.center, address: n(hit.en, hit.ar), source: 'search', districtId: districtAt(hit.center, districts)?.id ?? null });
              setFitTo({ points: [hit.center], key: `lm-${Date.now()}`, zoom: 15 });
            }
            if (mobile) setSnap('peek');
          }}
          canEdit={group.canEdit}
          minPeople={group.id ? 1 : 2}
          {...(group.id
            ? {
                onAdd: () => void group.join().catch(() => setError(t.requestFailed)),
                addLabel: group.isAdmin || Object.keys(group.creds?.people ?? {}).length ? t.addPerson : t.addMe,
              }
            : {})}
        />
        <SharePanel group={group} canShare={state.people.length > 0} />
      </div>
    );

  return (
    <div className="flex h-dvh md:flex-row">
      <BottomSheet mobile={mobile} snap={snap} onSnap={setSnap} top={top} footer={footer}>
        {body}
      </BottomSheet>

      <main className={mobile ? 'fixed inset-0' : 'relative flex-1'}>
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
            if (mobile) setSnap('half');
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
            if (mobile) setSnap('half');
          }}
          overlays={overlays}
          fitTo={fitTo}
          allVenues={visibleVenues}
          showAllVenues={showAllVenues}
          onToggleAllVenues={() => setShowAllVenues((s) => !s)}
          onPickVenue={!friendOnly ? pickVenue : undefined}
          insetBottom={mobile ? sheetPx(snap) : 0}
        />
        {focusPerson !== null && result && selected && (() => {
          const e = selected.etas.find((x) => x.person === focusPerson);
          const who = result.people[focusPerson];
          if (!e || !who?.location) return null;
          const car = routes[routeRequests(selected, result.people).find((r) => r.person === focusPerson && r.mode === 'car')?.key ?? ''];
          return (
            <div className={`absolute inset-x-3 z-[1100] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-card ${mobile ? 'top-16' : 'bottom-10'}`}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: personColor(focusPerson) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {t.routeOf(displayName(who, focusPerson, t.namePlaceholder))} → {n(selected.venue.name, selected.venue.nameAr)}
                </p>
                <p className="text-xs text-ink-soft">
                  {t.minutes(e.minutes)}
                  {car && typeof car === 'object' ? ` · ${t.distance(car.km * 1000)}` : ''}
                </p>
              </div>
              <a href={googleDirectionsUrl(who.location, selected.venue.location, e.mode)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sand-dark px-2 py-1 text-xs hover:border-brand">
                <Navigation size={13} aria-hidden /> {t.directions}
              </a>
              <button type="button" onClick={() => setFocusPerson(null)} className="shrink-0 rounded-lg bg-sand px-2 py-1 text-xs hover:bg-sand-dark">
                {t.showEveryone}
              </button>
            </div>
          );
        })()}
        {pickingName && (
          <div className="pointer-events-auto absolute inset-x-0 top-3 z-[1100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-ink/90 px-4 py-2 text-sm text-white shadow-card">
            <span>{focusDistrict ? t.refineBanner(pickingName, n(shortEn(focusDistrict), shortAr(focusDistrict))) : t.pickBanner(pickingName)}</span>
            <button
              type="button"
              className="shrink-0 rounded-full bg-white/15 px-3 py-0.5 hover:bg-white/25"
              onClick={() => {
                setPickingId(null);
                setFocusDistrict(null);
                if (mobile) setSnap('half');
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
