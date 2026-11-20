/**
 * Car directions (OSRM /route with steps) turned into short English instructions, plus Google Maps links.
 * Street names come from OpenStreetMap and are mostly Arabic.
 */
import type { LatLng } from './geo';
import { en, type CarStepInfo } from './i18n';

/** One driving instruction; the text is written in the UI language (`carStep` in lib/i18n.ts). */
export interface CarStep extends CarStepInfo {
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

/** English text of one OSRM step (tests, logs). */
export function stepText(s: OsrmStep): string {
  return en.carStep(toInfo(s));
}

function toInfo(s: OsrmStep): CarStepInfo {
  return {
    type: s.maneuver.type,
    ...(s.maneuver.modifier ? { modifier: s.maneuver.modifier } : {}),
    ...(s.maneuver.exit ? { exit: s.maneuver.exit } : {}),
    road: s.name?.trim() || s.ref?.trim() || '',
  };
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
    steps.push({ ...toInfo(s), meters: s.distance });
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
