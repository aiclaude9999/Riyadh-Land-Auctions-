import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMetroEstimator } from '@/lib/estimator';
import { toStations, type StationCollection } from '@/lib/metro';
import { buildTrack, pathLength, type LineFeature } from '@/lib/metroTrack';
import { buildPieces, routeKey, routeRequests } from '@/lib/routePieces';
import type { ScoredEta, ScoredVenue } from '@/lib/scoring';

const read = (f: string) => JSON.parse(readFileSync(path.join(__dirname, '../data', f), 'utf8'));
const stations = toStations(read('metro-stations.geojson') as StationCollection);
const tracks = new Map((read('metro-lines.geojson').features as LineFeature[]).map((f) => [f.properties.ref, buildTrack(f)] as const));
const home = { lat: 24.6629, lng: 46.7344 }; // Al Malaz
const venue = { lat: 24.7114, lng: 46.6744 }; // Olaya
const est = createMetroEstimator(stations).from(home)(venue);
const metroEta: ScoredEta = { person: 1, mode: 'metro', minutes: est.minutes, adjusted: est.minutes, source: 'estimated', walkMinutes: est.walkMinutes, detail: { legs: est.legs } };
const carEta: ScoredEta = { person: 0, mode: 'car', minutes: 20, adjusted: 20, source: 'api', walkMinutes: 0 };

describe('route pieces', () => {
  it('asks for one car route, and walking routes to and from the metro', () => {
    const v = { venue: { id: 'v', name: 'V', kind: 'cafe', location: venue }, etas: [carEta, metroEta] } as unknown as ScoredVenue;
    const people = [{ location: { lat: 24.8, lng: 46.6 } }, { location: home }] as never;
    const req = routeRequests(v, people);
    expect(req.map((r) => r.mode)).toEqual(['car', 'foot', 'foot']);
    expect(req[1].from).toEqual(home);
    expect(req[2].to).toEqual(venue);
  });

  it('metro: walk → ride along the track (line colour) → … → walk, with station dots', () => {
    const pieces = buildPieces(metroEta, home, venue, {}, tracks);
    const kinds = pieces.map((p) => p.kind);
    expect(kinds[0]).toBe('walk');
    expect(kinds.at(-1)).toBe('walk');
    expect(kinds).toContain('ride');
    expect(kinds).toContain('stop');
    const ride = pieces.find((p) => p.kind === 'ride');
    if (ride && ride.kind === 'ride') {
      expect(ride.points.length).toBeGreaterThan(3); // follows the track, not just two stations
      expect(pathLength(ride.points)).toBeGreaterThan(500);
    }
    // without walking routes loaded yet, walks are rough straight lines
    expect(pieces[0]).toMatchObject({ kind: 'walk', rough: true });
  });

  it('uses the loaded street route when there is one', () => {
    const first = (est.legs.find((l) => l.kind === 'ride') as { path: { lat: number; lng: number }[] }).path[0];
    const street = { minutes: 9, km: 0.7, steps: [], path: [{ lat: 24.664, lng: 46.733 }, { lat: 24.665, lng: 46.732 }] };
    const pieces = buildPieces(metroEta, home, venue, { [routeKey('foot', home, first)]: street }, tracks);
    expect(pieces[0]).toMatchObject({ kind: 'walk' });
    expect(pieces[0]).not.toHaveProperty('rough');
    if (pieces[0].kind === 'walk') expect(pieces[0].points).toHaveLength(4);
  });

  it('car: road route when loaded, else a rough straight line', () => {
    const from = { lat: 24.8, lng: 46.6 };
    expect(buildPieces(carEta, from, venue, {}, tracks)[0]).toMatchObject({ kind: 'car', rough: true });
    const road = { minutes: 20, km: 15, steps: [], path: [{ lat: 24.75, lng: 46.65 }] };
    expect(buildPieces(carEta, from, venue, { [routeKey('car', from, venue)]: road }, tracks)[0].kind).toBe('car');
  });
});
