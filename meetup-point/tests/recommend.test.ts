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
    // Wednesday 22:00 Riyadh: light traffic, metro running, no prayer window
    const deps: RecommendDeps = { stations, allVenues, osrm, now: () => new Date('2026-11-18T19:00:00Z') };
    const res = await recommend({ people: [sara, omar], venueType: 'both' }, deps);
    expect(osrm).toHaveBeenCalledTimes(2); // car group → venues, and car group → zone grid
    expect(osrm.mock.calls.every((c) => c[0].length === 1)).toBe(true);
    expect(res.meta.traffic.kind).toBe('typical');
    expect(res.zone?.cells.length).toBeGreaterThan(40);
    expect(res.results[0].warnings).toEqual({});
    expect(res.meta).toMatchObject({ dataSource: 'free', carSource: 'osrm', metroSource: 'estimate' });
    expect(res.meta.candidates).toBeGreaterThan(10);
    expect(res.results).toHaveLength(5);
    expect(res.results[0].etas[0]).toMatchObject({ source: 'api', mode: 'car' });
    expect(res.results[0].etas[1]).toMatchObject({ source: 'estimated', mode: 'metro' });
    const scores = res.results.map((r) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it('filters: near metro only, and one food group', async () => {
    const osrm = async (o: unknown[], d: unknown[]) => o.map(() => d.map(() => 15));
    const res = await recommend({ people: [sara, omar], venueType: 'both', filters: { nearMetro: true, food: 'coffee' } }, { stations, allVenues, osrm });
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      expect(r.nearStation && r.nearStation.meters <= 600).toBe(true);
    }
  });

  it('rush hour makes car trips longer in free mode; warnings for prayer and metro hours', async () => {
    const osrm = async (o: unknown[], d: unknown[]) => o.map(() => d.map(() => 20));
    const at = async (iso: string) => recommend({ people: [sara, omar], venueType: 'both' }, { stations, allVenues, osrm, now: () => new Date(iso) });
    const night = await at('2026-11-18T23:00:00Z'); // Thu 02:00 Riyadh → metro closed
    const rush = await at('2026-11-18T13:30:00Z'); // Wed 16:30 Riyadh
    const carNight = night.results[0].etas[0].minutes;
    const carRush = rush.results[0].etas[0].minutes;
    expect(carRush).toBeGreaterThan(carNight * 1.5);
    expect(night.results.some((r) => r.warnings.metroClosed?.includes(1))).toBe(true);
    const asr = await at('2026-11-18T11:15:00Z'); // leave Wed 14:15 Riyadh → arrive ~14:35–14:55, Asr ≈ 14:43
    expect(asr.results.some((r) => r.warnings.prayer?.name === 'Asr')).toBe(true);
  });

  it('"use as meeting place": scores exactly the picked place', async () => {
    const osrm = async (o: unknown[], d: unknown[]) => o.map(() => d.map(() => 12));
    const pick = allVenues[100];
    const r = parseRequest({ people: [sara, omar], venueType: 'both', venueIds: [pick.id, 5, 'x'.repeat(200)] });
    expect(r.venueIds).toEqual([pick.id]);
    const res = await recommend(r, { stations, allVenues, osrm });
    expect(res.results.map((x) => x.venue.id)).toEqual([pick.id]);
    expect(res.zone).toBeUndefined();
  });

  it('hidden places never come back', async () => {
    const osrm = async (o: unknown[], d: unknown[]) => o.map(() => d.map(() => 15));
    const first = await recommend({ people: [sara, omar], venueType: 'both' }, { stations, allVenues, osrm });
    const top = first.results[0].venue.id;
    const again = await recommend({ people: [sara, omar], venueType: 'both', prefs: { likes: [], avoids: [], favourites: [], hidden: [top] } }, { stations, allVenues, osrm });
    expect(again.results.map((r) => r.venue.id)).not.toContain(top);
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
