import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { haversineMeters, inRiyadh } from '@/lib/geo';
import { nearestStations, toStations, type StationCollection } from '@/lib/metro';

const fc = JSON.parse(readFileSync(path.join(__dirname, '../data/metro-stations.geojson'), 'utf8')) as StationCollection;
const stations = toStations(fc);

describe('metro-stations.geojson', () => {
  it('covers the whole network: 6 lines, ~85 stations, all inside Riyadh', () => {
    expect(stations.length).toBeGreaterThanOrEqual(80);
    expect(stations.length).toBeLessThanOrEqual(90);
    expect(new Set(stations.flatMap((s) => s.lines.map((l) => l.ref)))).toEqual(new Set(['1', '2', '3', '4', '5', '6']));
    expect(stations.every((s) => inRiyadh(s.position))).toBe(true);
    expect(stations.every((s) => s.name_en.length > 0)).toBe(true);
  });

  it('has unique, gap-free station order on every line', () => {
    for (const ref of ['1', '2', '3', '4', '5', '6']) {
      const seqs = stations.flatMap((s) => s.lines.filter((l) => l.ref === ref).map((l) => l.seq)).sort((a, b) => a - b);
      expect(seqs).toEqual(seqs.map((_, i) => i));
    }
  });

  it('marks KAFD as an interchange of lines 1, 4 and 6', () => {
    const kafd = stations.find((s) => /Financial District/i.test(s.name_en));
    expect(kafd?.interchange).toBe(true);
    expect(kafd?.lines.map((l) => l.ref).sort()).toEqual(['1', '4', '6']);
  });

  it('flags interchange exactly when a station is on more than one line', () => {
    expect(stations.every((s) => s.interchange === s.lines.length > 1)).toBe(true);
  });
});

describe('geo + nearestStations', () => {
  it('haversine: KAFD → Kingdom Centre is about 7 km', () => {
    const d = haversineMeters({ lat: 24.7677, lng: 46.6432 }, { lat: 24.7114, lng: 46.6744 });
    expect(d).toBeGreaterThan(6_500);
    expect(d).toBeLessThan(7_500);
  });

  it('returns the n nearest stations, closest first', () => {
    const kafd = stations.find((s) => /Financial District/i.test(s.name_en))!;
    const res = nearestStations(kafd.position, stations, 3);
    expect(res).toHaveLength(3);
    expect(res[0].station.id).toBe(kafd.id);
    expect(res[0].meters).toBeLessThan(1);
    expect(res[1].meters).toBeLessThanOrEqual(res[2].meters);
  });
});
