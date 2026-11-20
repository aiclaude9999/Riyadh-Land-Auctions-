import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fairnessWeights, type Meetup } from '@/lib/history';
import { toStations, type StationCollection } from '@/lib/metro';
import { recommend } from '@/lib/recommend.server';
import { metroRunningRamadan, nearIftar, ramadanTrafficFactor } from '@/lib/timing';
import type { Venue } from '@/lib/venues';
import { forecastTemp, heatFactorFor, heatFrom, typicalTempC } from '@/lib/weather';

const r = (local: string) => new Date(`${local}+03:00`);
const read = (f: string) => JSON.parse(readFileSync(path.join(__dirname, '../data', f), 'utf8'));
const stations = toStations(read('metro-stations.geojson') as StationCollection);
const allVenues = (read('venues-riyadh.json') as { venues: Venue[] }).venues;

describe('heat-aware walking', () => {
  it('typical temperatures: hot July afternoons, mild winter nights', () => {
    expect(typicalTempC(r('2026-07-15T15:00:00'))).toBeGreaterThan(42);
    expect(typicalTempC(r('2026-01-15T06:00:00'))).toBeLessThan(11);
  });
  it('factor 1 at ≤ 25 °C, 2 at ≥ 40 °C', () => {
    expect(heatFactorFor(20)).toBe(1);
    expect(heatFactorFor(32.5)).toBe(1.5);
    expect(heatFactorFor(46)).toBe(2);
  });
  it('uses the forecast hour when present, else typical', () => {
    const json = { hourly: { time: ['2026-11-20T15:00'], apparent_temperature: [31] } };
    expect(forecastTemp(json, r('2026-11-20T15:20:00'))).toBe(31);
    expect(heatFrom(json, r('2026-11-20T15:20:00'))).toMatchObject({ tempC: 31, source: 'forecast' });
    expect(heatFrom(null, r('2026-11-20T15:20:00')).source).toBe('typical');
  });
});

describe('Ramadan mode', () => {
  it('metro opens later and runs past midnight', () => {
    expect(metroRunningRamadan(r('2026-11-18T08:00:00'))).toBe(false);
    expect(metroRunningRamadan(r('2026-11-18T23:30:00'))).toBe(true);
    expect(metroRunningRamadan(r('2026-11-19T01:30:00'))).toBe(true);
  });
  it('pre-iftar rush, empty roads at iftar', () => {
    // Maghrib in Riyadh on 18 Nov 2026 ≈ 17:05
    expect(ramadanTrafficFactor(r('2026-11-18T16:30:00'))).toBeGreaterThan(1.7);
    expect(ramadanTrafficFactor(r('2026-11-18T17:20:00'))).toBe(1);
    expect(nearIftar(r('2026-11-18T16:40:00'))).toBe(true);
    expect(nearIftar(r('2026-11-18T20:00:00'))).toBe(false);
  });
});

describe('fairness over time', () => {
  const h: Meetup[] = [
    { id: '1', date: '', venue: 'A', people: [{ name: 'Omar', mode: 'metro', minutes: 50 }, { name: 'Sara', mode: 'car', minutes: 20 }] },
    { id: '2', date: '', venue: 'B', people: [{ name: 'Omar', mode: 'metro', minutes: 30, actual: 45 }, { name: 'sara ', mode: 'car', minutes: 25 }] },
  ];
  it('the one who travelled longer gets a weight > 1, the other < 1, strangers 1', () => {
    const [omar, sara, noura] = fairnessWeights(['Omar', 'Sara', 'Noura'], h);
    expect(omar).toBeGreaterThan(1.1);
    expect(sara).toBeLessThan(1);
    expect(sara).toBeGreaterThanOrEqual(0.9);
    expect(noura).toBe(1);
  });
});

describe('best time to meet and metro-friendly places', () => {
  it('suggests a calmer departure when rush hour makes the trip much longer', async () => {
    const osrm = async (o: unknown[], d: unknown[]) => o.map(() => d.map(() => 25));
    const res = await recommend(
      { venueType: 'both', people: [{ name: 'A', mode: 'car', location: { lat: 24.85, lng: 46.6 } }, { name: 'B', mode: 'car', location: { lat: 24.6, lng: 46.8 } }] },
      { stations, allVenues, osrm, now: () => r('2026-11-18T16:30:00') }, // Wednesday rush hour
    );
    expect(res.meta.timeOptions!.length).toBeGreaterThan(3);
    expect(res.meta.betterTime).toBeDefined();
    expect(res.meta.betterTime!.saves).toBeGreaterThanOrEqual(5);
  });
  it('marks places reachable without changing lines', async () => {
    const osrm = async (o: unknown[], d: unknown[]) => o.map(() => d.map(() => 15));
    const res = await recommend(
      { venueType: 'both', people: [{ name: 'A', mode: 'metro', location: { lat: 24.7677, lng: 46.6432 } }, { name: 'B', mode: 'car', location: { lat: 24.69, lng: 46.68 } }] },
      { stations, allVenues, osrm, now: () => r('2026-11-18T20:00:00') },
    );
    expect(res.results.some((x) => x.match.metroFriendly)).toBe(true);
  });
});
