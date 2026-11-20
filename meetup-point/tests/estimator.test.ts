import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMetroEstimator, DEFAULT_METRO, estimateCarMinutes, walkMinutes } from '@/lib/estimator';
import { toStations, type Station, type StationCollection } from '@/lib/metro';

const real = toStations(JSON.parse(readFileSync(path.join(__dirname, '../data/metro-stations.geojson'), 'utf8')) as StationCollection);

// Toy network: line A (blue) runs west→east through X, line B (red) leaves X northwards.
// 0.01° of longitude ≈ 1.01 km at this latitude.
const st = (id: string, lat: number, lng: number, lines: [string, number][]): Station => ({
  id,
  name_en: id,
  name_ar: '',
  interchange: lines.length > 1,
  position: { lat, lng },
  lines: lines.map(([ref, seq]) => ({ ref, name: ref, color: '#000', seq })),
});
const toy = [
  st('A0', 24.7, 46.6, [['A', 0]]),
  st('A1', 24.7, 46.62, [['A', 1]]),
  st('X', 24.7, 46.64, [['A', 2], ['B', 0]]),
  st('B1', 24.72, 46.64, [['B', 1]]),
  st('B2', 24.74, 46.64, [['B', 2]]),
];

describe('walkMinutes', () => {
  it('walks 1 km in 12 min at 5 km/h before the street detour', () => {
    const m = walkMinutes({ lat: 24.7, lng: 46.6 }, { lat: 24.709, lng: 46.6 }, { walkKmh: 5, walkDetour: 1 }); // ≈ 1.0 km north
    expect(m).toBeGreaterThan(11.9);
    expect(m).toBeLessThan(12.1);
  });
});

describe('metro estimator (spec fallback formula)', () => {
  const est = createMetroEstimator(toy, { walkDetour: 1 });

  it('standing on stations: wait + 1.5 min per station, no transfer', () => {
    const r = est.from(toy[0].position)(toy[2].position); // A0 → X: 2 stations on line A
    expect(r.walkOnly).toBe(false);
    expect(r.stations).toBe(2);
    expect(r.transfers).toBe(0);
    expect(r.minutes).toBeCloseTo(DEFAULT_METRO.waitMin + 2 * DEFAULT_METRO.minPerStation, 5);
  });

  it('adds 5 min per transfer', () => {
    const r = est.from(toy[0].position)(toy[4].position); // A0 → X (2) → transfer → B2 (2)
    expect(r.transfers).toBe(1);
    expect(r.stations).toBe(4);
    expect(r.minutes).toBeCloseTo(4 + 4 * 1.5 + 5, 5);
    expect(r).toMatchObject({ fromStation: 'A0', toStation: 'B2' });
  });

  it('lists the steps: walk, wait, ride toward the end of the line, change, ride, walk', () => {
    const r = est.from(toy[0].position)(toy[4].position);
    expect(r.legs.map((l) => l.kind)).toEqual(['walk', 'wait', 'ride', 'transfer', 'ride', 'walk']);
    const [, , ride1, transfer, ride2] = r.legs;
    expect(ride1).toMatchObject({ kind: 'ride', line: 'A', from: 'A0', to: 'X', toward: 'X', stops: 2 });
    expect(transfer).toMatchObject({ kind: 'transfer', at: 'X', toLine: 'B', toLineRef: 'B', atAr: 'X' });
    expect(ride2).toMatchObject({ kind: 'ride', line: 'B', from: 'X', to: 'B2', toward: 'B2', stops: 2 });
    if (ride1.kind === 'ride') expect(ride1.path).toHaveLength(3);
    const sum = r.legs.reduce((s, l) => s + l.minutes, 0);
    expect(sum).toBeCloseTo(r.minutes, 5);
  });

  it('direction is toward the first station when riding backwards', () => {
    const r = est.from(toy[2].position)(toy[0].position);
    const ride = r.legs.find((l) => l.kind === 'ride');
    expect(ride).toMatchObject({ toward: 'A0', stops: 2 });
  });

  it('walk-only trips have a single walk step', () => {
    const r = est.from({ lat: 24.705, lng: 46.61 })({ lat: 24.705, lng: 46.612 });
    expect(r.legs).toEqual([{ kind: 'walk', minutes: r.minutes, to: 'destination' }]);
  });

  it('adds walking at both ends', () => {
    const origin = { lat: 24.709, lng: 46.6 }; // ~1 km north of A0 → ~12 min walk
    const r = est.from(origin)(toy[2].position);
    expect(r.walkMinutes).toBeGreaterThan(11.5);
    expect(r.minutes).toBeCloseTo(r.walkMinutes + 4 + 3, 1);
  });

  it('just walks when that is quicker than the metro', () => {
    const r = est.from({ lat: 24.705, lng: 46.61 })({ lat: 24.705, lng: 46.612 }); // 200 m apart
    expect(r.walkOnly).toBe(true);
    expect(r.minutes).toBe(r.walkMinutes);
  });

  it('works on the real network: KAFD → National Museum is a short, plausible trip', () => {
    const kafd = real.find((s) => /Financial District/.test(s.name_en))!;
    const museum = real.find((s) => /National Museum/.test(s.name_en))!;
    const r = createMetroEstimator(real).from(kafd.position)(museum.position);
    expect(r.walkOnly).toBe(false);
    expect(r.minutes).toBeGreaterThan(15);
    expect(r.minutes).toBeLessThan(45);
  });
});

describe('estimateCarMinutes', () => {
  it('10 km straight line ≈ 26 min (1.35 detour at 35 km/h + 3 min parking)', () => {
    const m = estimateCarMinutes({ lat: 24.7, lng: 46.6 }, { lat: 24.79, lng: 46.6 });
    expect(m).toBeGreaterThan(25);
    expect(m).toBeLessThan(27);
  });
});
