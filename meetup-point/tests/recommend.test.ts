import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { toStations, type StationCollection } from '@/lib/metro';
import { BadRequest, parseRequest, recommend, type RecommendDeps } from '@/lib/recommend.server';
import type { Venue } from '@/lib/venues';

const stations = toStations(JSON.parse(readFileSync(path.join(__dirname, '../data/metro-stations.geojson'), 'utf8')) as StationCollection);
const allVenues = (JSON.parse(readFileSync(path.join(__dirname, '../data/venues-riyadh.json'), 'utf8')) as { venues: Venue[] }).venues;
const sara = { name: 'Sara', mode: 'car' as const, location: { lat: 24.81354, lng: 46.58478 } };
const omar = { name: 'Omar', mode: 'metro' as const, location: { lat: 24.6389, lng: 46.76605 } };

describe('parseRequest', () => {
  it('accepts a valid request and treats a past time as "now"', () => {
    const r = parseRequest({ people: [sara, omar], venueType: 'cafe', departAt: '2020-01-01T10:00:00Z' });
    expect(r.venueType).toBe('cafe');
    expect(r.departAt).toBeUndefined();
  });
  it('rejects bad input', () => {
    expect(() => parseRequest({ people: [sara] })).toThrow(BadRequest);
    expect(() => parseRequest({ people: [sara, { ...omar, location: { lat: 21.5, lng: 39.2 } }] })).toThrow(/too far/);
    expect(() => parseRequest({ people: [sara, { ...omar, mode: 'bike' }] })).toThrow(/mode/);
  });
});

describe('recommend (free mode, routers faked)', () => {
  it('car via OSRM, metro estimated; returns 5 ranked venues', async () => {
    const osrm = vi.fn(async (o: unknown[], d: unknown[]) => o.map(() => d.map((_, i) => 15 + (i % 7))));
    const deps: RecommendDeps = { stations, allVenues, osrm };
    const res = await recommend({ people: [sara, omar], venueType: 'both' }, deps);
    expect(osrm).toHaveBeenCalledTimes(1); // one call for the car group
    expect(osrm.mock.calls[0][0]).toHaveLength(1);
    expect(res.meta).toMatchObject({ dataSource: 'free', carSource: 'osrm', metroSource: 'estimate' });
    expect(res.meta.candidates).toBeGreaterThan(10);
    expect(res.results).toHaveLength(5);
    expect(res.results[0].etas[0]).toMatchObject({ source: 'api', mode: 'car' });
    expect(res.results[0].etas[1]).toMatchObject({ source: 'estimated', mode: 'metro' });
    const scores = res.results.map((r) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it('falls back to estimated car times when OSRM is down', async () => {
    const deps: RecommendDeps = { stations, allVenues, osrm: async () => { throw new Error('down'); } };
    const res = await recommend({ people: [sara, { ...omar, mode: 'car' }], venueType: 'cafe' }, deps);
    expect(res.meta.carSource).toBe('estimate');
    expect(res.meta.notes).toContain('car_router_failed');
    expect(res.results.every((r) => r.etas.every((e) => e.source === 'estimated'))).toBe(true);
    expect(res.results.every((r) => r.venue.kind === 'cafe')).toBe(true);
  });

  it('Google mode: TRANSIT gaps use the local estimate', async () => {
    const venues: Venue[] = allVenues.slice(0, 6);
    const matrix = vi.fn(async (mode: string, o: unknown[], d: unknown[]) => o.map(() => d.map((_, i) => (mode === 'TRANSIT' && i === 0 ? null : 20))));
    const deps: RecommendDeps = { stations, allVenues, osrm: vi.fn(), google: { candidates: async () => venues, matrix } };
    const res = await recommend({ people: [sara, omar], venueType: 'both' }, deps);
    expect(matrix.mock.calls.map((c) => c[0]).sort()).toEqual(['DRIVE', 'TRANSIT']);
    expect(res.meta).toMatchObject({ dataSource: 'google', carSource: 'google-traffic', metroSource: 'google-transit' });
    const first = res.results.find((r) => r.venue.id === venues[0].id);
    if (first) expect(first.etas[1].source).toBe('estimated');
    expect(res.results.filter((r) => r.venue.id !== venues[0].id).every((r) => r.etas[1].source === 'api')).toBe(true);
  });
});
