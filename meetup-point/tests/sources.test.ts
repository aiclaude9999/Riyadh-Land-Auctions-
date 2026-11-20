import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlaces, parseRouteMatrix } from '@/lib/google.server';
import { parseOsrmTable } from '@/lib/osrm.server';
import { parseOverpass } from '@/lib/venues';

const fx = (f: string) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));

describe('parseOverpass (real trimmed Overpass reply)', () => {
  const venues = parseOverpass(fx('overpass-riyadh.json'));
  it('keeps named cafés/restaurants with a position, ways via their centre', () => {
    expect(venues.length).toBeGreaterThan(5);
    expect(venues.every((v) => v.name && (v.kind === 'cafe' || v.kind === 'restaurant'))).toBe(true);
    expect(venues.every((v) => v.location.lat > 24.3 && v.location.lat < 25.1)).toBe(true);
    expect(venues.some((v) => /^osm-w/.test(v.id))).toBe(true);
  });
  it('drops closed / disused places', () => {
    const out = parseOverpass({ elements: [{ type: 'node', id: 1, lat: 24.7, lon: 46.7, tags: { amenity: 'cafe', name: 'Gone', disused: 'yes' } }] });
    expect(out).toEqual([]);
  });
});

describe('parseOsrmTable (real reply)', () => {
  it('converts seconds to minutes', () => {
    const m = parseOsrmTable(fx('osrm-table.json'));
    expect(m).toHaveLength(2);
    expect(m[0][0]).toBeCloseTo(942 / 60, 5);
  });
  it('throws on errors', () => {
    expect(() => parseOsrmTable({ code: 'NoRoute' })).toThrow();
  });
});

describe('Google parsers (documented response shapes)', () => {
  it('route matrix: "123s" → minutes, missing routes stay null', () => {
    const m = parseRouteMatrix(
      [
        { originIndex: 0, destinationIndex: 1, duration: '600s', condition: 'ROUTE_EXISTS' },
        { originIndex: 0, destinationIndex: 0, condition: 'ROUTE_NOT_FOUND' },
      ],
      1,
      2,
    );
    expect(m).toEqual([[null, 10]]);
  });
  it('places: drops closed, unrated and < 3.8', () => {
    const base = { displayName: { text: 'X' }, location: { latitude: 24.7, longitude: 46.7 } };
    const out = parsePlaces(
      [
        { ...base, id: 'ok', rating: 4.2, businessStatus: 'OPERATIONAL', primaryType: 'cafe' },
        { ...base, id: 'low', rating: 3.5 },
        { ...base, id: 'unrated' },
        { ...base, id: 'closed', rating: 4.8, businessStatus: 'CLOSED_PERMANENTLY' },
        { ...base, id: 'shutNow', rating: 4.5, currentOpeningHours: { openNow: false } },
      ],
      { minRating: 3.8, requireOpenNow: true },
    );
    expect(out.map((v) => v.id)).toEqual(['g-ok']);
    expect(out[0]).toMatchObject({ kind: 'cafe', rating: 4.2 });
  });
});
