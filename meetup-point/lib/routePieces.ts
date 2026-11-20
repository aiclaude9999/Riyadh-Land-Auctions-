/**
 * Turns one person's trip to the meeting place into map pieces, like a Google Maps route:
 * car = road route; metro = walk (streets) → ride (along the track, in the line colour) → … → walk.
 * Missing data falls back to straight dashed lines (`rough`).
 */
import type { CarRoute } from './directions';
import type { MetroLeg } from './estimator';
import type { LatLng } from './geo';
import type { Person } from './people';
import { personColor } from './people';
import { ridePath, type buildTrack } from './metroTrack';
import type { ScoredEta, ScoredVenue } from './scoring';

export type RoutePiece =
  | { kind: 'car' | 'walk' | 'ride'; points: LatLng[]; color: string; rough?: boolean }
  | { kind: 'stop'; at: LatLng; color: string; name: string; nameAr: string };

type RouteState = CarRoute | 'loading' | 'error' | undefined;
type Track = ReturnType<typeof buildTrack>;

const k = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
export const routeKey = (mode: 'car' | 'foot', from: LatLng, to: LatLng) => `${mode}:${k(from)}>${k(to)}`;

function rides(e: ScoredEta): Extract<MetroLeg, { kind: 'ride' }>[] {
  return (e.detail?.legs ?? []).filter((l): l is Extract<MetroLeg, { kind: 'ride' }> => l.kind === 'ride');
}

/** Which road/walking routes the selected place needs. */
export function routeRequests(venue: ScoredVenue, people: Person[]) {
  const out: { key: string; mode: 'car' | 'foot'; from: LatLng; to: LatLng; person: number }[] = [];
  for (const e of venue.etas) {
    const from = people[e.person]?.location;
    if (!from) continue;
    const to = venue.venue.location;
    if (e.mode === 'car') {
      out.push({ key: routeKey('car', from, to), mode: 'car', from, to, person: e.person });
      continue;
    }
    const r = rides(e);
    if (!r.length) {
      out.push({ key: routeKey('foot', from, to), mode: 'foot', from, to, person: e.person });
      continue;
    }
    const first = r[0].path[0];
    const last = r[r.length - 1].path.at(-1)!;
    out.push({ key: routeKey('foot', from, first), mode: 'foot', from, to: first, person: e.person });
    out.push({ key: routeKey('foot', last, to), mode: 'foot', from: last, to, person: e.person });
  }
  return out;
}

const walk = (routes: Record<string, RouteState>, from: LatLng, to: LatLng, color: string): RoutePiece => {
  const r = routes[routeKey('foot', from, to)];
  return r && typeof r === 'object' ? { kind: 'walk', points: [from, ...r.path, to], color } : { kind: 'walk', points: [from, to], color, rough: true };
};

export function buildPieces(e: ScoredEta, from: LatLng | null, to: LatLng, routes: Record<string, RouteState>, tracks: Map<string, Track>): RoutePiece[] {
  if (!from) return [];
  const color = personColor(e.person);
  if (e.mode === 'car') {
    const r = routes[routeKey('car', from, to)];
    return [r && typeof r === 'object' ? { kind: 'car', points: [from, ...r.path, to], color } : { kind: 'car', points: [from, to], color, rough: true }];
  }
  const legs = e.detail?.legs ?? [];
  const r = rides(e);
  if (!r.length) return [walk(routes, from, to, color)];
  const pieces: RoutePiece[] = [walk(routes, from, r[0].path[0], color)];
  for (const leg of legs) {
    if (leg.kind !== 'ride') continue;
    pieces.push({ kind: 'ride', points: ridePath(tracks.get(leg.line), leg.path), color: leg.color });
    pieces.push({ kind: 'stop', at: leg.path[0], color: leg.color, name: leg.from, nameAr: leg.fromAr });
    pieces.push({ kind: 'stop', at: leg.path.at(-1)!, color: leg.color, name: leg.to, nameAr: leg.toAr });
  }
  pieces.push(walk(routes, r[r.length - 1].path.at(-1)!, to, color));
  return pieces;
}
