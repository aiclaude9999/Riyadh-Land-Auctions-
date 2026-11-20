/**
 * Free car travel times from the public OSRM demo server (OpenStreetMap roads, no live traffic).
 * Its usage policy allows light use like this prototype; a busy public site should host its own OSRM.
 */
import { parseOsrmRoute, type CarRoute } from './directions';
import type { LatLng } from './geo';

const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';

/** Parses an OSRM /table response into minutes[source][destination] (null = no route). */
export function parseOsrmTable(json: { code?: string; durations?: (number | null)[][] }): (number | null)[][] {
  if (json.code !== 'Ok' || !json.durations) throw new Error(`OSRM: ${json.code ?? 'bad response'}`);
  return json.durations.map((row) => row.map((s) => (s == null ? null : s / 60)));
}

/** Car minutes from each origin to each destination. */
export async function osrmCarMinutes(origins: LatLng[], destinations: LatLng[]): Promise<(number | null)[][]> {
  const coords = [...origins, ...destinations].map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const sources = origins.map((_, i) => i).join(';');
  const dests = destinations.map((_, i) => origins.length + i).join(';');
  const url = `${OSRM_URL}/table/v1/driving/${coords}?sources=${sources}&destinations=${dests}&annotations=duration`;
  const res = await fetch(url, { headers: { 'User-Agent': 'riyadh-meetup-point-prototype/0.1' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`OSRM: HTTP ${res.status}`);
  return parseOsrmTable(await res.json());
}

/** Car route with turn-by-turn steps and the line to draw on the map. */
export async function osrmCarRoute(from: LatLng, to: LatLng): Promise<CarRoute> {
  const coords = [from, to].map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { headers: { 'User-Agent': 'riyadh-meetup-point-prototype/0.1' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`OSRM route: HTTP ${res.status}`);
  const route = parseOsrmRoute(await res.json());
  // full geometry can be long; keep at most ~400 points for the map
  const step = Math.max(1, Math.ceil(route.path.length / 400));
  return { ...route, path: route.path.filter((_, i) => i % step === 0 || i === route.path.length - 1) };
}
