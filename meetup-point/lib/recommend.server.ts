/**
 * The /api/recommend pipeline: candidates → travel times → scoring.
 * Free mode (no GOOGLE_MAPS_API_KEY): OSM venues file + OSRM car times + local metro estimate.
 * Google mode: Places searchNearby + Routes matrix (DRIVE traffic-aware, TRANSIT); any missing
 * route falls back to the local estimate and is flagged "estimated".
 * Data sources are passed in (`deps`) so tests can run without the network.
 */
import { inRiyadh, type LatLng } from './geo';
import type { Station as StationT } from './metro';
import { createMetroEstimator, estimateCarMinutes, type MetroEstimate, type MetroLeg, type MetroParams } from './estimator';
import type { Station } from './metro';
import { venueGroups, CUISINE_GROUPS, type CuisineGroup } from './cuisine';
import { haversineMeters } from './geo';
import { nearestStations } from './metro';
import type { Filters, RecommendRequest, RecommendResponse, ResultVenue, Zone } from './recommendTypes';
import { directionFactor, metroRunning, metroWaitMin, prayerOverlap, trafficFactor } from './timing';
import { DEFAULT_SCORING, pickCandidates, scoreVenues, searchArea, type Eta, type ScoredVenue, type ScoringParams } from './scoring';
import { allowedByPrefs, prefBonus, sanitizePrefs } from './preferences';
import { matchesType, type Venue, type VenueType } from './venues';

export interface RecommendDeps {
  stations: Station[];
  /** Free mode: every known venue (OSM file). */
  allVenues: Venue[];
  osrm: (origins: LatLng[], dests: LatLng[]) => Promise<(number | null)[][]>;
  google?: {
    candidates: (area: ReturnType<typeof searchArea>, type: VenueType, departAt?: string) => Promise<Venue[]>;
    matrix: (mode: 'DRIVE' | 'TRANSIT', origins: LatLng[], dests: LatLng[], departAt?: string) => Promise<(number | null)[][]>;
  };
  params?: ScoringParams;
  /** clock for tests */
  now?: () => Date;
  /** real walking minutes between two points (street router); used for the best few places */
  footMinutes?: (from: LatLng, to: LatLng) => Promise<number>;
  /** learned corrections from people's real trip times (lib/calibration.server.ts) */
  calibration?: { car: number; metro: number };
}

export const NEAR_METRO_M = 600;
const ZONE_GRID = 12; // 12 × 12 points, sent to OSRM in batches of < 100 coordinates

function passesFilters(v: Venue, f: Filters, stations: StationT[]): boolean {
  if (f.nearMetro) {
    const near = nearestStations(v.location, stations, 1)[0];
    if (!near || near.meters > NEAR_METRO_M) return false;
  }
  if (f.food && !venueGroups(v).includes(f.food)) return false;
  return true;
}

export class BadRequest extends Error {}

/** Validates the browser's JSON. Throws BadRequest with a readable message. */
export function parseRequest(body: unknown): RecommendRequest {
  const b = body as Partial<RecommendRequest> | null;
  if (!b || !Array.isArray(b.people)) throw new BadRequest('people missing');
  if (b.people.length < 2 || b.people.length > 6) throw new BadRequest('need 2–6 people');
  const people = b.people.map((p, i) => {
    const lat = Number(p?.location?.lat);
    const lng = Number(p?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequest(`person ${i + 1} has no location`);
    if (Math.abs(lat - 24.7) > 2 || Math.abs(lng - 46.7) > 2) throw new BadRequest(`person ${i + 1} is too far from Riyadh`);
    if (p.mode !== 'car' && p.mode !== 'metro') throw new BadRequest(`person ${i + 1}: mode must be car or metro`);
    return { name: String(p.name ?? '').slice(0, 40), mode: p.mode, location: { lat, lng }, access: p.access === 'car' ? ('car' as const) : ('walk' as const) };
  });
  const venueType = b.venueType ?? 'both';
  if (!['cafe', 'restaurant', 'both'].includes(venueType)) throw new BadRequest('venueType must be cafe, restaurant or both');
  let departAt: string | undefined;
  if (b.departAt) {
    const t = new Date(b.departAt);
    if (Number.isNaN(t.getTime())) throw new BadRequest('departAt is not a date');
    if (t.getTime() > Date.now() + 60_000) departAt = t.toISOString(); // past or "now" → leave now
  }
  const prefs = sanitizePrefs(b.prefs);
  const f = (b.filters ?? {}) as Filters;
  const filters: Filters = {
    nearMetro: f.nearMetro === true,
    food: CUISINE_GROUPS.includes(f.food as CuisineGroup) ? (f.food as CuisineGroup) : null,
  };
  const weights = Array.isArray(b.weights) && b.weights.length === people.length ? b.weights.map((w) => Math.min(1.3, Math.max(0.8, Number(w) || 1))) : undefined;
  const heat = Number(b.heatFactor);
  const heatFactor = Number.isFinite(heat) ? Math.min(2.5, Math.max(1, heat)) : undefined;
  const venueIds = Array.isArray(b.venueIds) ? b.venueIds.filter((x): x is string => typeof x === 'string' && x.length < 80).slice(0, 3) : [];
  return { people, venueType, ...(departAt ? { departAt } : {}), prefs, filters, ...(venueIds.length ? { venueIds } : {}), ...(weights ? { weights } : {}), ...(heatFactor ? { heatFactor } : {}) };
}

/** OSRM's public table accepts ~100 points per call: split the destinations into batches. */
async function osrmBatched(osrm: RecommendDeps['osrm'], origins: LatLng[], dests: LatLng[]): Promise<(number | null)[][]> {
  const size = Math.max(10, 95 - origins.length);
  const out: (number | null)[][] = origins.map(() => []);
  for (let i = 0; i < dests.length; i += size) {
    const part = await osrm(origins, dests.slice(i, i + size));
    part.forEach((row, r) => out[r].push(...row));
  }
  return out;
}

/**
 * Stage 1 of the search: the zone grid tells where trips are fairest. Keep places inside the best
 * cells (longest trip within ~25 % / 8 min of the best cell), so the search is not stuck around the
 * plain geographic middle. Falls back to the circle when that area has too few places.
 */
export function fairAreaVenues(zone: Zone | undefined, venues: Venue[]): Venue[] | null {
  if (!zone?.cells.length) return null;
  const best = Math.min(...zone.cells.map((c) => c.maxEta));
  const limit = best + Math.max(8, best * 0.25);
  const good = zone.cells.filter((c) => c.maxEta <= limit);
  const inGood = (v: Venue) => good.some((c) => Math.abs(v.location.lat - c.lat) <= zone.cellLat * 0.75 && Math.abs(v.location.lng - c.lng) <= zone.cellLng * 0.75);
  const pool = venues.filter(inGood);
  return pool.length >= 20 ? pool : null;
}

/**
 * Places within 400 m of the stations that suit this group best (rough longest trip to the station:
 * car = estimate × traffic, metro = network estimate). 2 places per station.
 */
function stationVenues(
  pool: Venue[],
  req: RecommendRequest,
  deps: RecommendDeps,
  area: { center: LatLng; radiusM: number },
  factor: number,
  metroOpts: (i: number) => Partial<MetroParams>,
  stationsWanted: number,
): Venue[] {
  const near = deps.stations.filter((s) => haversineMeters(s.position, area.center) <= area.radiusM * 1.5);
  if (!near.length) return [];
  const est = req.people.map((x, i) => (x.mode === 'metro' ? createMetroEstimator(deps.stations, metroOpts(i)).from(x.location) : null));
  const rated = near
    .map((s) => ({ s, worst: Math.max(...req.people.map((x, i) => (est[i] ? est[i]!(s.position).minutes : estimateCarMinutes(x.location, s.position) * factor))) }))
    .sort((a, b) => a.worst - b.worst)
    .slice(0, stationsWanted);
  const out: Venue[] = [];
  for (const { s } of rated) {
    pool
      .map((v) => ({ v, d: haversineMeters(v.location, s.position) }))
      .filter((x) => x.d <= 400)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach((x) => out.push(x.v));
  }
  return out;
}

export async function recommend(req: RecommendRequest, deps: RecommendDeps): Promise<RecommendResponse> {
  const p = { ...(deps.params ?? DEFAULT_SCORING), ...(deps.google ? {} : { maxCandidates: 100 }) };
  const travellers = req.people.map((x, i) => ({ location: x.location, mode: x.mode, weight: req.weights?.[i] ?? 1 }));
  const area = searchArea(travellers, deps.stations, p);
  const notes: string[] = [];
  if (req.people.some((x) => !inRiyadh(x.location))) notes.push('someone_outside_riyadh');

  const prefs = sanitizePrefs(req.prefs);
  const filters = req.filters ?? {};
  const allowed = (v: Venue) => allowedByPrefs(v, prefs) && passesFilters(v, filters, deps.stations);
  const leaveAt = req.departAt ? new Date(req.departAt) : (deps.now?.() ?? new Date());
  // free mode has no live traffic: scale road times by the typical slowdown at that hour
  const factor = deps.google ? 1 : trafficFactor(leaveAt);
  const calib = deps.calibration ?? { car: 1, metro: 1 };
  const wait = metroWaitMin(leaveAt);
  const metroOpts = (i: number) => ({ waitMin: wait, transferMin: 2 + wait, access: req.people[i].access ?? 'walk', carMinutes: (a: LatLng, b: LatLng) => estimateCarMinutes(a, b) * factor });

  // Stage 1: where are trips fairest? (skipped when the user picked a place on the map)
  const zone = req.venueIds?.length
    ? undefined
    : await computeZone(req, area, deps, factor, metroOpts).catch((e) => {
        console.error(e);
        return undefined;
      });

  // Stage 2: candidates
  let venues: Venue[];
  if (req.venueIds?.length) venues = deps.allVenues.filter((v) => req.venueIds!.includes(v.id));
  else if (deps.google) venues = (await deps.google.candidates(area, req.venueType, req.departAt)).filter(allowed).slice(0, p.maxCandidates);
  else {
    const pool = deps.allVenues.filter((v) => matchesType(v, req.venueType) && allowed(v));
    const fair = fairAreaVenues(zone, pool);
    // three sources, ~100 places in all: the fairest area, next to the stations best for this group,
    // and a spread over the whole search circle (so nothing obvious is missed)
    const fromFair = fair ? pickCandidates(fair, { ...area, radiusM: area.radiusM * 2 }, { ...p, maxCandidates: 45 }) : [];
    const fromStations = stationVenues(pool, req, deps, area, factor, metroOpts, 15);
    const fromCircle = pickCandidates(pool, area, { ...p, maxCandidates: 100 });
    const seen = new Set<string>();
    venues = [...fromFair, ...fromStations, ...fromCircle].filter((v) => !seen.has(v.id) && !!seen.add(v.id)).slice(0, p.maxCandidates);
    if (fair) notes.push('fair_area_search');
  }

  const meta: RecommendResponse['meta'] = {
    dataSource: deps.google ? 'google' : 'free',
    carSource: 'none',
    metroSource: 'none',
    center: area.center,
    radiusM: Math.round(area.radiusM),
    leaveAt: leaveAt.toISOString(),
    traffic: { kind: deps.google ? 'live' : 'typical', factor: +factor.toFixed(2) },
    candidates: venues.length,
    metroWaitMin: wait,
    calibration: calib,
    notes,
  };
  if (!venues.length) return { results: [], meta, zone };

  // Stage 3: travel times — one routing request per mode group (batched)
  const etas: (Eta | null)[][] = venues.map(() => req.people.map(() => null));
  const dests = venues.map((v) => v.location);
  const carIdx = req.people.flatMap((x, i) => (x.mode === 'car' ? [i] : []));
  const metroIdx = req.people.flatMap((x, i) => (x.mode === 'metro' ? [i] : []));

  if (carIdx.length) {
    let minutes: (number | null)[][] | null = null;
    try {
      minutes = deps.google
        ? await deps.google.matrix('DRIVE', carIdx.map((i) => req.people[i].location), dests, req.departAt)
        : await osrmBatched(deps.osrm, carIdx.map((i) => req.people[i].location), dests);
      meta.carSource = deps.google ? 'google-traffic' : 'osrm';
    } catch (e) {
      console.error(e);
      meta.carSource = 'estimate';
      notes.push('car_router_failed');
    }
    carIdx.forEach((pi, row) => {
      const from = req.people[pi].location;
      venues.forEach((v, vi) => {
        const m = minutes?.[row]?.[vi];
        // typical traffic × direction (into the centre in the morning / out in the afternoon) × learned correction
        const adj = deps.google ? calib.car : factor * directionFactor(from, v.location, leaveAt) * calib.car;
        etas[vi][pi] = m != null ? { minutes: m * adj, source: 'api', walkMinutes: 0 } : { minutes: estimateCarMinutes(from, v.location) * adj, source: 'estimated', walkMinutes: 0 };
      });
    });
  }

  if (metroIdx.length) {
    let transit: (number | null)[][] | null = null;
    if (deps.google) {
      try {
        transit = await deps.google.matrix('TRANSIT', metroIdx.map((i) => req.people[i].location), dests, req.departAt);
      } catch (e) {
        console.error(e);
        notes.push('transit_failed');
      }
    }
    let usedApi = false;
    metroIdx.forEach((pi, row) => {
      const est = createMetroEstimator(deps.stations, metroOpts(pi)).from(req.people[pi].location);
      venues.forEach((v, vi) => {
        const local: MetroEstimate = est(v.location);
        const detail = { fromStation: local.fromStation, fromStationAr: local.fromStationAr, toStation: local.toStation, toStationAr: local.toStationAr, transfers: local.transfers, walkOnly: local.walkOnly, legs: local.legs };
        const api = transit?.[row]?.[vi];
        if (api != null) usedApi = true;
        // Google's matrix has no walking breakdown, so the heat penalty uses our walking estimate.
        etas[vi][pi] =
          api != null
            ? { minutes: api * calib.metro, source: 'api', walkMinutes: local.walkMinutes, detail }
            : { minutes: local.minutes * calib.metro, source: 'estimated', walkMinutes: local.walkMinutes, detail };
      });
    });
    meta.metroSource = usedApi ? 'google-transit' : 'estimate';
  }

  // Stage 4: score; then make the best few exact with real walking routes and score them again
  const heat = req.heatFactor ?? p.heatFactor;
  const params = { ...p, heatFactor: heat, topN: Math.max(p.topN, 10) };
  let scored = scoreVenues(venues, travellers, etas, deps.stations, params, (v) => prefBonus(v, prefs));
  if (deps.footMinutes && metroIdx.length) {
    const refined = await refineWalking(scored.slice(0, 6), deps.footMinutes, req.people.map((x) => x.location));
    if (refined) {
      const ids = new Set(scored.slice(0, 6).map((r) => r.venue.id));
      const sub = venues.map((v, vi) => ({ v, vi })).filter(({ v }) => ids.has(v.id));
      const subEtas = sub.map(({ v, vi }) => refined.get(v.id) ?? etas[vi]);
      const rescored = scoreVenues(sub.map((x) => x.v), travellers, subEtas, deps.stations, params, (v) => prefBonus(v, prefs));
      scored = [...rescored, ...scored.filter((r) => !ids.has(r.venue.id))].map((r, i) => ({ ...r, rank: i + 1 }));
      notes.push('walking_refined');
    }
  }
  scored = scored.slice(0, p.topN);

  // time warnings (prayer pause on arrival, metro outside hours)
  const at = (min: number) => new Date(leaveAt.getTime() + min * 60_000);
  const results: ResultVenue[] = scored.map((r) => {
    const mins = r.etas.map((e) => e.minutes);
    const prayer = prayerOverlap(at(Math.min(...mins)), at(Math.max(...mins)));
    const metroClosed = r.etas
      .filter((e) => e.mode === 'metro' && !e.detail?.walkOnly && (!metroRunning(leaveAt) || !metroRunning(at(e.minutes))))
      .map((e) => e.person);
    const longWalk = r.etas.filter((e) => e.mode === 'metro' && e.detail?.legs?.[0]?.kind === 'walk' && !e.detail.walkOnly && e.detail.legs[0].minutes > 20).map((e) => e.person);
    return { ...r, warnings: { ...(prayer ? { prayer } : {}), ...(metroClosed.length ? { metroClosed } : {}), ...(longWalk.length ? { longWalk } : {}) } };
  });
  return { results, meta, zone };
}

/**
 * Replace estimated walking (straight line × 1.25) with real street walking times for the few best
 * places, so the list and the drawn route agree. At most 12 walking-router calls per search.
 */
async function refineWalking(top: ScoredVenue[], foot: NonNullable<RecommendDeps['footMinutes']>, origins: LatLng[]): Promise<Map<string, (Eta | null)[]> | null> {
  const jobs: { venue: string; person: number; leg: 'in' | 'out'; from: LatLng; to: LatLng }[] = [];
  for (const r of top) {
    for (const e of r.etas) {
      if (e.mode !== 'metro' || !e.detail?.legs) continue;
      const legs = e.detail.legs;
      const rides = legs.filter((l) => l.kind === 'ride') as Extract<MetroLeg, { kind: 'ride' }>[];
      if (!rides.length) continue;
      if (legs[0].kind === 'walk') jobs.push({ venue: r.venue.id, person: e.person, leg: 'in', from: origins[e.person], to: rides[0].path[0] });
      jobs.push({ venue: r.venue.id, person: e.person, leg: 'out', from: rides.at(-1)!.path.at(-1)!, to: r.venue.location });
    }
  }
  if (!jobs.length) return null;
  const limited = jobs.slice(0, 12);
  const times = await Promise.all(limited.map((j) => foot(j.from, j.to).catch(() => null)));
  if (times.every((x) => x == null)) return null;
  const out = new Map<string, (Eta | null)[]>();
  for (const r of top) {
    out.set(
      r.venue.id,
      r.etas.map((e) => {
        if (e.mode !== 'metro' || !e.detail?.legs) return e;
        let minutes = e.minutes;
        let walk = e.walkMinutes;
        const legs = e.detail.legs.map((l) => ({ ...l }));
        limited.forEach((j, k) => {
          const real = times[k];
          if (real == null || j.venue !== r.venue.id || j.person !== e.person) return;
          const leg = j.leg === 'in' ? legs[0] : legs[legs.length - 1];
          if (leg.kind !== 'walk') return;
          minutes += real - leg.minutes;
          walk += real - leg.minutes;
          leg.minutes = real;
        });
        return { minutes, source: e.source, walkMinutes: walk, detail: { ...e.detail, legs } };
      }),
    );
  }
  return out;
}

/**
 * "Everyone within X min" zone: a 9×9 grid over the search area; for each point the longest trip of
 * the group (car: OSRM × traffic factor, or rough estimate; metro: local estimate). Approximate by design.
 */
export async function computeZone(
  req: RecommendRequest,
  area: { center: LatLng; radiusM: number },
  deps: RecommendDeps,
  factor: number,
  metroOpts: (i: number) => Partial<MetroParams> = () => ({}),
): Promise<Zone> {
  const half = area.radiusM;
  const cellLat = (2 * half) / ZONE_GRID / 111_320;
  const cellLng = cellLat / Math.cos((area.center.lat * Math.PI) / 180);
  const points: LatLng[] = [];
  for (let i = 0; i < ZONE_GRID; i++)
    for (let j = 0; j < ZONE_GRID; j++)
      points.push({ lat: area.center.lat + (i - (ZONE_GRID - 1) / 2) * cellLat, lng: area.center.lng + (j - (ZONE_GRID - 1) / 2) * cellLng });

  // minutes[person][point]
  const per: number[][] = req.people.map(() => points.map(() => 0));
  const carIdx = req.people.flatMap((x, i) => (x.mode === 'car' ? [i] : []));
  if (carIdx.length) {
    let m: (number | null)[][] | null = null;
    try {
      m = await osrmBatched(deps.osrm, carIdx.map((i) => req.people[i].location), points);
    } catch {
      m = null;
    }
    carIdx.forEach((pi, row) => points.forEach((pt, k) => (per[pi][k] = (m?.[row]?.[k] ?? estimateCarMinutes(req.people[pi].location, pt)) * factor)));
  }
  req.people.forEach((x, pi) => {
    if (x.mode !== 'metro') return;
    const f = createMetroEstimator(deps.stations, metroOpts(pi)).from(x.location);
    points.forEach((pt, k) => (per[pi][k] = f(pt).minutes));
  });
  const worst = points.map((_, k) => Math.max(...per.map((row) => row[k])));
  // drop points far outside the circle (corners) to keep the shading round-ish
  const cells = points
    .map((pt, k) => ({ lat: +pt.lat.toFixed(5), lng: +pt.lng.toFixed(5), maxEta: Math.round(worst[k]), per: per.map((row) => Math.round(row[k])) }))
    .filter((c) => haversineMeters(c, area.center) <= area.radiusM * 1.25);
  return { cells, cellLat: +cellLat.toFixed(6), cellLng: +cellLng.toFixed(6) };
}
