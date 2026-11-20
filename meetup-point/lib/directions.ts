/**
 * Car directions (OSRM /route with steps) turned into short English instructions, plus Google Maps links.
 * Street names come from OpenStreetMap and are mostly Arabic.
 */
import type { LatLng } from './geo';

export interface CarStep {
  text: string;
  meters: number;
}

export interface CarRoute {
  minutes: number;
  km: number;
  path: LatLng[];
  steps: CarStep[];
}

interface OsrmStep {
  name?: string;
  ref?: string;
  distance: number;
  maneuver: { type: string; modifier?: string; exit?: number };
}

const DIR: Record<string, string> = {
  left: 'left',
  right: 'right',
  'slight left': 'slightly left',
  'slight right': 'slightly right',
  'sharp left': 'sharp left',
  'sharp right': 'sharp right',
  straight: 'straight',
  uturn: 'U-turn',
};

/** One OSRM maneuver → "Turn right onto شارع العليا". */
export function stepText(s: OsrmStep): string {
  const road = s.name?.trim() || s.ref?.trim() || '';
  const onto = road ? ` onto ${road}` : '';
  const on = road ? ` on ${road}` : '';
  const dir = DIR[s.maneuver.modifier ?? ''] ?? '';
  switch (s.maneuver.type) {
    case 'depart':
      return `Start${on}`;
    case 'arrive':
      return 'Arrive at the meeting place';
    case 'roundabout':
    case 'rotary':
      return `At the roundabout take exit ${s.maneuver.exit ?? ''}${onto}`.replace('exit  ', 'the exit ');
    case 'on ramp':
      return `Take the ramp${dir && dir !== 'straight' ? ` on the ${dir.replace('slightly ', '')}` : ''}${onto}`;
    case 'off ramp':
      return `Take the exit${dir && dir !== 'straight' ? ` on the ${dir.replace('slightly ', '')}` : ''}${onto}`;
    case 'fork':
      return `Keep ${dir.replace('slightly ', '') || 'straight'} at the fork${onto}`;
    case 'merge':
      return `Merge${onto}`;
    case 'end of road':
      return `At the end of the road turn ${dir || 'as signed'}${onto}`;
    case 'continue':
    case 'new name':
      return `Continue${onto}`;
    default:
      if (dir === 'straight') return `Go straight${onto}`;
      if (dir === 'U-turn') return `Make a U-turn${onto}`;
      return `Turn ${dir || 'ahead'}${onto}`;
  }
}

/** Parses an OSRM route reply; consecutive steps on the same road are merged to keep the list short. */
export function parseOsrmRoute(json: {
  code?: string;
  routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[];
}): CarRoute {
  const r = json.routes?.[0];
  if (json.code !== 'Ok' || !r) throw new Error(`OSRM route: ${json.code ?? 'bad response'}`);
  const steps: CarStep[] = [];
  let lastRoad: string | null = null;
  for (const s of r.legs.flatMap((l) => l.steps)) {
    const road = s.name?.trim() || s.ref?.trim() || '';
    const minor = ['fork', 'merge', 'continue', 'new name'].includes(s.maneuver.type) || s.maneuver.modifier === 'straight';
    if (steps.length && s.maneuver.type !== 'arrive' && minor && (road === lastRoad || !road)) {
      steps[steps.length - 1].meters += s.distance; // same road (or unnamed link): fold into previous step
      continue;
    }
    steps.push({ text: stepText(s), meters: s.distance });
    if (road) lastRoad = road;
  }
  return {
    minutes: r.duration / 60,
    km: r.distance / 1000,
    path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    steps,
  };
}

const ll = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Google Maps directions (opens the app on phones). Real traffic and real train times. */
export function googleDirectionsUrl(from: LatLng, to: LatLng, mode: 'car' | 'metro'): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(from)}&destination=${ll(to)}&travelmode=${mode === 'car' ? 'driving' : 'transit'}`;
}

/** Google Maps page of a place (stars and reviews). With a Google place id it is exact; otherwise a search at that spot. */
export function googleReviewsUrl(name: string, at: LatLng, googlePlaceId?: string): string {
  if (googlePlaceId) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(googlePlaceId)}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${ll(at)},18z`;
}
