/**
 * Meeting-point scoring (spec "Algorithm"). Pure functions — no I/O — so they are easy to test.
 *
 * Score per venue (lower is better):
 *   primary  = longest adjusted trip across the group (minimax fairness) − metro bonus
 *   tiebreak = sum of adjusted trips
 *   adjusted trip = ETA, plus for metro users the walking minutes × (heatFactor − 1),
 *                   i.e. their walking counts 1.5× (summer heat; configurable)
 *   bonus    = 3 min off when the venue is ≤ 400 m from a metro station
 */
import { haversineMeters, type LatLng } from './geo';
import { nearestStations, type Station } from './metro';
import type { Venue } from './venues';

export interface ScoringParams {
  heatFactor: number;
  metroBonusMin: number;
  metroBonusMeters: number;
  /** Primary scores this close (minutes) count as a tie and fall through to the sum. */
  tieMin: number;
  minRadiusM: number;
  radiusFactor: number;
  stationCandidateRadiusM: number;
  candidateStations: number;
  maxCandidates: number;
  topN: number;
}

export const DEFAULT_SCORING: ScoringParams = {
  heatFactor: 1.5,
  metroBonusMin: 3,
  metroBonusMeters: 400,
  tieMin: 0.5,
  minRadiusM: 3000,
  radiusFactor: 0.5,
  stationCandidateRadiusM: 600,
  candidateStations: 3,
  maxCandidates: 40,
  topN: 5,
};

export interface Traveller {
  location: LatLng;
  mode: 'car' | 'metro';
  /** Centroid weight (default 1). */
  weight?: number;
}

export interface SearchArea {
  center: LatLng;
  radiusM: number;
  /** Stations nearest the centroid; venues within stationCandidateRadiusM of them are also candidates. */
  stations: { station: Station; meters: number }[];
}

/** Step 1: weighted centroid, radius = max(3 km, 0.5 × largest distance between two people). */
export function searchArea(people: Traveller[], stations: Station[], p: ScoringParams = DEFAULT_SCORING): SearchArea {
  const total = people.reduce((s, x) => s + (x.weight ?? 1), 0);
  const center = {
    lat: people.reduce((s, x) => s + x.location.lat * (x.weight ?? 1), 0) / total,
    lng: people.reduce((s, x) => s + x.location.lng * (x.weight ?? 1), 0) / total,
  };
  let maxPair = 0;
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) maxPair = Math.max(maxPair, haversineMeters(people[i].location, people[j].location));
  return { center, radiusM: Math.max(p.minRadiusM, p.radiusFactor * maxPair), stations: nearestStations(center, stations, p.candidateStations) };
}

/**
 * Step 2 (free mode): pick up to `maxCandidates` venues. Venues near the 3 central stations first
 * (up to 5 per station), then the rest of the circle spread over a grid so candidates are not all
 * bunched in one street. Within a cell, the venue closest to the cell centre wins; ties prefer
 * venues with more information (brand, opening hours).
 */
export function pickCandidates(venues: Venue[], area: SearchArea, p: ScoringParams = DEFAULT_SCORING): Venue[] {
  const picked = new Map<string, Venue>();
  for (const { station } of area.stations) {
    venues
      .map((v) => ({ v, d: haversineMeters(v.location, station.position) }))
      .filter((x) => x.d <= p.stationCandidateRadiusM)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .forEach(({ v }) => picked.set(v.id, v));
  }

  const inCircle = venues.filter((v) => !picked.has(v.id) && haversineMeters(v.location, area.center) <= area.radiusM);
  const slots = p.maxCandidates - picked.size;
  if (slots > 0 && inCircle.length) {
    const grid = Math.max(2, Math.ceil(Math.sqrt(slots * 1.3)));
    const cellDeg = ((2 * area.radiusM) / grid / 111_320) as number;
    const cells = new Map<string, { v: Venue; d: number; info: number }[]>();
    for (const v of inCircle) {
      const cx = Math.floor((v.location.lng - area.center.lng) / cellDeg);
      const cy = Math.floor((v.location.lat - area.center.lat) / cellDeg);
      const cellCentre = { lat: area.center.lat + (cy + 0.5) * cellDeg, lng: area.center.lng + (cx + 0.5) * cellDeg };
      const info = (v.brand ? 1 : 0) + (v.openingHours ? 1 : 0) + (v.cuisine ? 0.5 : 0);
      const key = `${cx},${cy}`;
      cells.set(key, [...(cells.get(key) ?? []), { v, d: haversineMeters(v.location, cellCentre), info }]);
    }
    const queues = [...cells.values()].map((list) => list.sort((a, b) => b.info - a.info || a.d - b.d));
    // round-robin over cells (centre-most cells first) until the slots are filled
    queues.sort((a, b) => haversineMeters(a[0].v.location, area.center) - haversineMeters(b[0].v.location, area.center));
    for (let round = 0; picked.size < p.maxCandidates && queues.some((q) => q.length > round); round++) {
      for (const q of queues) {
        if (picked.size >= p.maxCandidates) break;
        if (q[round]) picked.set(q[round].v.id, q[round].v);
      }
    }
  }
  return [...picked.values()];
}

export interface Eta {
  minutes: number;
  source: 'api' | 'estimated';
  /** Minutes on foot inside this trip (metro users; used for the heat penalty). */
  walkMinutes: number;
  detail?: { fromStation?: string; toStation?: string; transfers?: number; walkOnly?: boolean };
}

export interface ScoredEta extends Eta {
  person: number;
  mode: 'car' | 'metro';
  adjusted: number;
}

export interface ScoredVenue {
  venue: Venue;
  rank: number;
  score: number;
  maxEta: number;
  sumEta: number;
  worstPerson: number;
  spreadMin: number;
  nearStation?: { name: string; meters: number; bonusMin: number };
  etas: ScoredEta[];
}

/**
 * Steps 4–5: score every venue and return the best `topN`, with the breakdown the UI uses to
 * explain "why this venue". `etas[v][p]` = trip of person p to venue v (null = no route at all).
 */
export function scoreVenues(
  venues: Venue[],
  people: Traveller[],
  etas: (Eta | null)[][],
  stations: Station[],
  p: ScoringParams = DEFAULT_SCORING,
): ScoredVenue[] {
  const scored: ScoredVenue[] = [];
  venues.forEach((venue, vi) => {
    const row = etas[vi];
    if (!row || row.some((e) => e == null || !Number.isFinite(e.minutes))) return; // someone cannot get there
    const list: ScoredEta[] = row.map((e, pi) => {
      const mode = people[pi].mode;
      const penalty = mode === 'metro' ? e!.walkMinutes * (p.heatFactor - 1) : 0;
      return { ...e!, person: pi, mode, adjusted: e!.minutes + penalty };
    });
    const worst = list.reduce((a, b) => (b.adjusted > a.adjusted ? b : a));
    const near = nearestStations(venue.location, stations, 1)[0];
    const bonus = near && near.meters <= p.metroBonusMeters ? p.metroBonusMin : 0;
    const raw = list.map((e) => e.minutes);
    scored.push({
      venue,
      rank: 0,
      score: worst.adjusted - bonus,
      maxEta: Math.max(...raw),
      sumEta: list.reduce((s, e) => s + e.adjusted, 0),
      worstPerson: worst.person,
      spreadMin: Math.max(...raw) - Math.min(...raw),
      ...(near && near.meters <= 800 ? { nearStation: { name: near.station.name_en, meters: Math.round(near.meters), bonusMin: bonus } } : {}),
      etas: list,
    });
  });

  // primary score in tieMin buckets, then the sum; venue id keeps the order stable
  const bucket = (s: number) => Math.round(s / p.tieMin);
  scored.sort((a, b) => bucket(a.score) - bucket(b.score) || a.sumEta - b.sumEta || a.venue.id.localeCompare(b.venue.id));
  return scored.slice(0, p.topN).map((s, i) => ({ ...s, rank: i + 1 }));
}
