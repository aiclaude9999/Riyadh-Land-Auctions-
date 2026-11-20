/** Data sources for /api/recommend and the group search (loaded once per server process). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hasServerKey, parsePlaces, routeMatrix, searchNearby } from './google.server';
import { toStations, type StationCollection } from './metro';
import { TtlCache } from './cache';
import { getCalibration } from './calibration.server';
import type { LatLng } from './geo';
import { osrmCarMinutes, osrmRoute } from './osrm.server';
import { getStore } from './store.server';
import { heatFrom, type Heat } from './weather';
import type { RecommendDeps } from './recommend.server';
import type { Venue } from './venues';

const read = <T,>(file: string): T => JSON.parse(readFileSync(path.join(process.cwd(), 'data', file), 'utf8')) as T;
const stations = toStations(read<StationCollection>('metro-stations.geojson'));
export const allVenues = read<{ venues: Venue[] }>('venues-riyadh.json').venues;
const MIN_RATING = 3.8;

const footCache = new TtlCache<number>(60 * 60 * 1000, 2000);
/** Real walking minutes along streets (FOSSGIS walking router), cached for an hour. */
async function footMinutes(from: LatLng, to: LatLng): Promise<number> {
  const k = [from.lat, from.lng, to.lat, to.lng].map((x) => x.toFixed(4)).join(',');
  const hit = footCache.get(k);
  if (hit != null) return hit;
  const r = await osrmRoute(from, to, 'foot');
  footCache.set(k, r.minutes);
  return r.minutes;
}

let weatherCache: { at: number; json: unknown } | null = null;
/** Open-Meteo hourly forecast for Riyadh (free, no key), cached 1 h; typical temperatures if it fails. */
async function heat(at: Date): Promise<Heat> {
  if (!weatherCache || Date.now() - weatherCache.at > 3600_000) {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=24.71&longitude=46.68&hourly=temperature_2m,apparent_temperature&timezone=Asia%2FRiyadh&forecast_days=7', {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      const json = res.ok ? await res.json() : null;
      weatherCache = { at: Date.now(), json: json && !(json as { error?: boolean }).error ? json : null };
    } catch {
      weatherCache = { at: Date.now() - 3000_000, json: null }; // retry in ~10 min
    }
  }
  return heatFrom(weatherCache.json as never, at);
}

export async function recommendDeps(): Promise<RecommendDeps> {
  const calib = await getCalibration(getStore()).catch(() => ({ car: 1, metro: 1 }));
  const base = { stations, allVenues, osrm: osrmCarMinutes, footMinutes, heat, calibration: { car: calib.car, metro: calib.metro } };
  if (!hasServerKey()) return base;
  return {
    ...base,
    google: {
      // centroid circle + 600 m around the 3 central stations; dedupe; drop closed / rating < 3.8
      async candidates(area, type, departAt) {
        const calls = [searchNearby(area.center, area.radiusM, type), ...area.stations.map((s) => searchNearby(s.station.position, 600, type))];
        const seen = new Map<string, Venue>();
        for (const list of await Promise.all(calls))
          for (const v of parsePlaces(list, { minRating: MIN_RATING, requireOpenNow: !departAt })) if (!seen.has(v.id)) seen.set(v.id, v);
        return [...seen.values()];
      },
      matrix: routeMatrix,
    },
  };
}
