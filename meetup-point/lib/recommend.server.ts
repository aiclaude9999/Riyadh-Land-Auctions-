/**
 * The /api/recommend pipeline: candidates → travel times → scoring.
 * Free mode (no GOOGLE_MAPS_API_KEY): OSM venues file + OSRM car times + local metro estimate.
 * Google mode: Places searchNearby + Routes matrix (DRIVE traffic-aware, TRANSIT); any missing
 * route falls back to the local estimate and is flagged "estimated".
 * Data sources are passed in (`deps`) so tests can run without the network.
 */
import { inRiyadh, type LatLng } from './geo';
import type { Station as StationT } from './metro';
import { createMetroEstimator, estimateCarMinutes, type MetroEstimate } from './estimator';
import type { Station } from './metro';
import { venueGroups, CUISINE_GROUPS, type CuisineGroup } from './cuisine';
import { haversineMeters } from './geo';
import { nearestStations } from './metro';
import type { Filters, RecommendRequest, RecommendResponse, ResultVenue, Zone } from './recommendTypes';
import { metroRunning, prayerOverlap, trafficFactor } from './timing';
import { DEFAULT_SCORING, pickCandidates, scoreVenues, searchArea, type Eta, type ScoringParams } from './scoring';
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
}

export const NEAR_METRO_M = 600;
const ZONE_GRID = 9; // 9 × 9 points; with ≤ 6 origins this stays under the OSRM demo's 100-coordinate table limit

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
    return { name: String(p.name ?? '').slice(0, 40), mode: p.mode, location: { lat, lng } };
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
  return { people, venueType, ...(departAt ? { departAt } : {}), prefs, filters };
}

export async function recommend(req: RecommendRequest, deps: RecommendDeps): Promise<RecommendResponse> {
  const p = deps.params ?? DEFAULT_SCORING;
  const travellers = req.people.map((x) => ({ location: x.location, mode: x.mode }));
  const area = searchArea(travellers, deps.stations, p);
  const notes: string[] = [];
  if (req.people.some((x) => !inRiyadh(x.location))) notes.push('someone_outside_riyadh');

  // 1–2. candidates
  const prefs = sanitizePrefs(req.prefs);
  const filters = req.filters ?? {};
  const allowed = (v: Venue) => allowedByPrefs(v, prefs) && passesFilters(v, filters, deps.stations);
  const leaveAt = req.departAt ? new Date(req.departAt) : (deps.now?.() ?? new Date());
  // free mode has no live traffic: scale road times by the typical slowdown at that hour
  const factor = deps.google ? 1 : trafficFactor(leaveAt);
  const venues = deps.google
    ? (await deps.google.candidates(area, req.venueType, req.departAt)).filter(allowed).slice(0, p.maxCandidates)
    : pickCandidates(deps.allVenues.filter((v) => matchesType(v, req.venueType) && allowed(v)), area, p);

  const meta: RecommendResponse['meta'] = {
    dataSource: deps.google ? 'google' : 'free',
    carSource: 'none',
    metroSource: 'none',
    center: area.center,
    radiusM: Math.round(area.radiusM),
    leaveAt: leaveAt.toISOString(),
    traffic: { kind: deps.google ? 'live' : 'typical', factor: +factor.toFixed(2) },
    candidates: venues.length,
    notes,
  };
  const zonePromise = computeZone(req, area, deps, factor).catch((e) => {
    console.error(e);
    return undefined;
  });
  if (!venues.length) return { results: [], meta, zone: await zonePromise };

  // 3. travel times — one call per mode group
  const etas: (Eta | null)[][] = venues.map(() => req.people.map(() => null));
  const dests = venues.map((v) => v.location);
  const carIdx = req.people.flatMap((x, i) => (x.mode === 'car' ? [i] : []));
  const metroIdx = req.people.flatMap((x, i) => (x.mode === 'metro' ? [i] : []));

  if (carIdx.length) {
    let minutes: (number | null)[][] | null = null;
    try {
      minutes = deps.google
        ? await deps.google.matrix('DRIVE', carIdx.map((i) => req.people[i].location), dests, req.departAt)
        : await deps.osrm(carIdx.map((i) => req.people[i].location), dests);
      meta.carSource = deps.google ? 'google-traffic' : 'osrm';
    } catch (e) {
      console.error(e);
      meta.carSource = 'estimate';
      notes.push('car_router_failed');
    }
    carIdx.forEach((pi, row) => {
      venues.forEach((v, vi) => {
        const m = minutes?.[row]?.[vi];
        etas[vi][pi] = m != null ? { minutes: m * factor, source: 'api', walkMinutes: 0 } : { minutes: estimateCarMinutes(req.people[pi].location, v.location) * factor, source: 'estimated', walkMinutes: 0 };
      });
    });
  }

  if (metroIdx.length) {
    const estimator = createMetroEstimator(deps.stations);
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
      const est = estimator.from(req.people[pi].location);
      venues.forEach((v, vi) => {
        const local: MetroEstimate = est(v.location);
        const detail = { fromStation: local.fromStation, fromStationAr: local.fromStationAr, toStation: local.toStation, toStationAr: local.toStationAr, transfers: local.transfers, walkOnly: local.walkOnly, legs: local.legs };
        const api = transit?.[row]?.[vi];
        if (api != null) usedApi = true;
        // Google's matrix has no walking breakdown, so the heat penalty uses our walking estimate.
        etas[vi][pi] = api != null ? { minutes: api, source: 'api', walkMinutes: local.walkMinutes, detail } : { minutes: local.minutes, source: 'estimated', walkMinutes: local.walkMinutes, detail };
      });
    });
    meta.metroSource = usedApi ? 'google-transit' : 'estimate';
  }

  // 4–5. score, then add time warnings (prayer pause on arrival, metro outside hours)
  const scored = scoreVenues(venues, travellers, etas, deps.stations, p, (v) => prefBonus(v, prefs));
  const at = (min: number) => new Date(leaveAt.getTime() + min * 60_000);
  const results: ResultVenue[] = scored.map((r) => {
    const mins = r.etas.map((e) => e.minutes);
    const prayer = prayerOverlap(at(Math.min(...mins)), at(Math.max(...mins)));
    const metroClosed = r.etas
      .filter((e) => e.mode === 'metro' && !e.detail?.walkOnly && (!metroRunning(leaveAt) || !metroRunning(at(e.minutes))))
      .map((e) => e.person);
    return { ...r, warnings: { ...(prayer ? { prayer } : {}), ...(metroClosed.length ? { metroClosed } : {}) } };
  });
  return { results, meta, zone: await zonePromise };
}

/**
 * "Everyone within X min" zone: a 9×9 grid over the search area; for each point the longest trip of
 * the group (car: OSRM × traffic factor, or rough estimate; metro: local estimate). Approximate by design.
 */
export async function computeZone(req: RecommendRequest, area: { center: LatLng; radiusM: number }, deps: RecommendDeps, factor: number): Promise<Zone> {
  const half = area.radiusM;
  const cellLat = (2 * half) / ZONE_GRID / 111_320;
  const cellLng = cellLat / Math.cos((area.center.lat * Math.PI) / 180);
  const points: LatLng[] = [];
  for (let i = 0; i < ZONE_GRID; i++)
    for (let j = 0; j < ZONE_GRID; j++)
      points.push({ lat: area.center.lat + (i - (ZONE_GRID - 1) / 2) * cellLat, lng: area.center.lng + (j - (ZONE_GRID - 1) / 2) * cellLng });

  const worst = points.map(() => 0);
  const cars = req.people.filter((x) => x.mode === 'car');
  if (cars.length) {
    let m: (number | null)[][] | null = null;
    try {
      m = await deps.osrm(cars.map((c) => c.location), points);
    } catch {
      m = null;
    }
    cars.forEach((c, ci) =>
      points.forEach((pt, k) => {
        const v = (m?.[ci]?.[k] ?? estimateCarMinutes(c.location, pt)) * factor;
        worst[k] = Math.max(worst[k], v);
      }),
    );
  }
  const metros = req.people.filter((x) => x.mode === 'metro');
  if (metros.length) {
    const est = createMetroEstimator(deps.stations);
    for (const mp of metros) {
      const f = est.from(mp.location);
      points.forEach((pt, k) => (worst[k] = Math.max(worst[k], f(pt).minutes)));
    }
  }
  // drop points far outside the circle (corners) to keep the shading round-ish
  const cells = points
    .map((pt, k) => ({ lat: +pt.lat.toFixed(5), lng: +pt.lng.toFixed(5), maxEta: Math.round(worst[k]) }))
    .filter((c) => haversineMeters(c, area.center) <= area.radiusM * 1.25);
  return { cells, cellLat: +cellLat.toFixed(6), cellLng: +cellLng.toFixed(6) };
}
