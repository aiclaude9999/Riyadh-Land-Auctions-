/** Data sources for /api/recommend and the group search (loaded once per server process). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hasServerKey, parsePlaces, routeMatrix, searchNearby } from './google.server';
import { toStations, type StationCollection } from './metro';
import { osrmCarMinutes } from './osrm.server';
import type { RecommendDeps } from './recommend.server';
import type { Venue } from './venues';

const read = <T,>(file: string): T => JSON.parse(readFileSync(path.join(process.cwd(), 'data', file), 'utf8')) as T;
const stations = toStations(read<StationCollection>('metro-stations.geojson'));
const allVenues = read<{ venues: Venue[] }>('venues-riyadh.json').venues;
const MIN_RATING = 3.8;

export function recommendDeps(): RecommendDeps {
  if (!hasServerKey()) return { stations, allVenues, osrm: osrmCarMinutes };
  return {
    stations,
    allVenues,
    osrm: osrmCarMinutes,
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
