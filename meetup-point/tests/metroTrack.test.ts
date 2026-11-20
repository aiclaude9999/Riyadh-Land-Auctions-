import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { haversineMeters } from '@/lib/geo';
import { toStations, type StationCollection } from '@/lib/metro';
import { buildTrack, pathLength, ridePath, type LineFeature } from '@/lib/metroTrack';

const read = (f: string) => JSON.parse(readFileSync(path.join(__dirname, '../data', f), 'utf8'));
const lines = read('metro-lines.geojson').features as LineFeature[];
const stations = toStations(read('metro-stations.geojson') as StationCollection);

describe('ridePath follows the track', () => {
  it('every pair of neighbouring stations on every line is joined by track, not much longer than a straight line', () => {
    let straightFallbacks = 0;
    let pairs = 0;
    for (const line of lines) {
      const g = buildTrack(line);
      const onLine = stations
        .filter((s) => s.lines.some((l) => l.ref === line.properties.ref))
        .sort((a, b) => a.lines.find((l) => l.ref === line.properties.ref)!.seq - b.lines.find((l) => l.ref === line.properties.ref)!.seq);
      for (let i = 1; i < onLine.length; i++) {
        pairs++;
        const p = ridePath(g, [onLine[i - 1].position, onLine[i].position]);
        const straight = haversineMeters(onLine[i - 1].position, onLine[i].position);
        if (p.length === 2) straightFallbacks++;
        expect(pathLength(p)).toBeGreaterThanOrEqual(straight * 0.99);
        expect(pathLength(p)).toBeLessThan(straight * 3 + 50);
      }
    }
    expect(pairs).toBeGreaterThan(70);
    expect(straightFallbacks / pairs).toBeLessThan(0.1); // nearly all follow real track
  });
});
