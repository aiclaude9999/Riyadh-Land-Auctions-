import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { TtlCache } from '@/lib/cache';
import { hasServerKey, parsePlaces, routeMatrix, searchNearby } from '@/lib/google.server';
import { toStations, type StationCollection } from '@/lib/metro';
import { osrmCarMinutes } from '@/lib/osrm.server';
import { BadRequest, parseRequest, recommend, type RecommendDeps } from '@/lib/recommend.server';
import type { RecommendError, RecommendResponse } from '@/lib/recommendTypes';
import type { Venue } from '@/lib/venues';

const read = <T,>(file: string): T => JSON.parse(readFileSync(path.join(process.cwd(), 'data', file), 'utf8')) as T;
const stations = toStations(read<StationCollection>('metro-stations.geojson'));
const allVenues = read<{ venues: Venue[] }>('venues-riyadh.json').venues;
const cache = new TtlCache<RecommendResponse>(); // 10 min

const MIN_RATING = 3.8;

function deps(): RecommendDeps {
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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<RecommendError>({ error: 'bad_request', message: 'invalid JSON' }, { status: 400 });
  }
  try {
    const request = parseRequest(body);
    const key = JSON.stringify({
      ...request,
      people: request.people.map((p) => ({ m: p.mode, lat: p.location.lat.toFixed(4), lng: p.location.lng.toFixed(4) })),
      g: hasServerKey(),
    });
    const hit = cache.get(key);
    if (hit) return NextResponse.json(hit);
    const result = await recommend(request, deps());
    if (result.results.length) cache.set(key, result);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BadRequest) return NextResponse.json<RecommendError>({ error: 'bad_request', message: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json<RecommendError>({ error: 'upstream', message: 'A data service failed. Try again in a minute.' }, { status: 502 });
  }
}
