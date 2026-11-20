/**
 * The /api/recommend pipeline: candidates → travel times → scoring.
 * Free mode (no GOOGLE_MAPS_API_KEY): OSM venues file + OSRM car times + local metro estimate.
 * Google mode: Places searchNearby + Routes matrix (DRIVE traffic-aware, TRANSIT); any missing
 * route falls back to the local estimate and is flagged "estimated".
 * Data sources are passed in (`deps`) so tests can run without the network.
 */
import { inRiyadh, type LatLng } from './geo';
import { createMetroEstimator, estimateCarMinutes, type MetroEstimate } from './estimator';
import type { Station } from './metro';
import type { RecommendRequest, RecommendResponse } from './recommendTypes';
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
  return { people, venueType, ...(departAt ? { departAt } : {}), prefs };
}

export async function recommend(req: RecommendRequest, deps: RecommendDeps): Promise<RecommendResponse> {
  const p = deps.params ?? DEFAULT_SCORING;
  const travellers = req.people.map((x) => ({ location: x.location, mode: x.mode }));
  const area = searchArea(travellers, deps.stations, p);
  const notes: string[] = [];
  if (req.people.some((x) => !inRiyadh(x.location))) notes.push('someone_outside_riyadh');

  // 1–2. candidates
  const prefs = sanitizePrefs(req.prefs);
  const allowed = (v: Venue) => allowedByPrefs(v, prefs);
  const venues = deps.google
    ? (await deps.google.candidates(area, req.venueType, req.departAt)).filter(allowed).slice(0, p.maxCandidates)
    : pickCandidates(deps.allVenues.filter((v) => matchesType(v, req.venueType) && allowed(v)), area, p);

  const meta: RecommendResponse['meta'] = {
    dataSource: deps.google ? 'google' : 'free',
    carSource: 'none',
    metroSource: 'none',
    center: area.center,
    radiusM: Math.round(area.radiusM),
    candidates: venues.length,
    notes,
  };
  if (!venues.length) return { results: [], meta };

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
        etas[vi][pi] = m != null ? { minutes: m, source: 'api', walkMinutes: 0 } : { minutes: estimateCarMinutes(req.people[pi].location, v.location), source: 'estimated', walkMinutes: 0 };
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
        const detail = { fromStation: local.fromStation, toStation: local.toStation, transfers: local.transfers, walkOnly: local.walkOnly, legs: local.legs };
        const api = transit?.[row]?.[vi];
        if (api != null) usedApi = true;
        // Google's matrix has no walking breakdown, so the heat penalty uses our walking estimate.
        etas[vi][pi] = api != null ? { minutes: api, source: 'api', walkMinutes: local.walkMinutes, detail } : { minutes: local.minutes, source: 'estimated', walkMinutes: local.walkMinutes, detail };
      });
    });
    meta.metroSource = usedApi ? 'google-transit' : 'estimate';
  }

  // 4–5. score
  return { results: scoreVenues(venues, travellers, etas, deps.stations, p, (v) => prefBonus(v, prefs)), meta };
}
