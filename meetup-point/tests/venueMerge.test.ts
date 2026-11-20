import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dedupeSelf, mergeVenues, namesMatch, normName, type SourcedVenue } from '@/lib/venueMerge';
import { fromCompact, toCompact } from '@/lib/venueLayer';
import type { Venue } from '@/lib/venues';

const v = (id: string, name: string, lat: number, lng: number, extra: Partial<SourcedVenue> = {}): SourcedVenue => ({ id, name, kind: 'cafe', location: { lat, lng }, sources: [id.split('-')[0]], ...extra });

describe('name matching', () => {
  it('ignores case, accents, "cafe/restaurant/مطعم" words and punctuation', () => {
    expect(normName("Dunkin' Café")).toBe(normName('DUNKIN'));
    expect(namesMatch('Tim Hortons', 'Tim Hortons Al Olaya')).toBe(true);
    expect(namesMatch('مطعم البيك', 'البيك')).toBe(true);
    expect(namesMatch('Starbucks', 'Burger King')).toBe(false);
  });
});

describe('mergeVenues', () => {
  const osm = [v('osm-n1', 'Tim Hortons', 24.7, 46.7, { cuisine: 'coffee shop' }), v('osm-n2', 'Only In OSM', 24.71, 46.71)];
  const ovt = [
    v('ovt-a', 'Tim Hortons - تيم هورتنز', 24.7003, 46.7002, { nameAr: 'تيم هورتنز', address: 'King Fahd Rd' }), // same place, ~40 m
    v('ovt-b', 'Tim Hortons', 24.72, 46.72), // another branch, 3 km away
    v('ovt-c', 'New Cafe', 24.7001, 46.7001), // different name next door
  ];
  const merged = mergeVenues(osm, ovt);

  it('keeps the OSM id for a place found in both, and fills missing details', () => {
    const tim = merged.find((x) => x.id === 'osm-n1')!;
    expect(tim.sources.sort()).toEqual(['osm', 'ovt']);
    expect(tim).toMatchObject({ nameAr: 'تيم هورتنز', address: 'King Fahd Rd', cuisine: 'coffee shop' });
  });
  it('adds other branches and different neighbours', () => {
    expect(merged.map((x) => x.id).sort()).toEqual(['osm-n1', 'osm-n2', 'ovt-b', 'ovt-c']);
  });
  it('dedupeSelf drops the same name at the same spot, keeping the more confident one', () => {
    const d = dedupeSelf([v('ovt-x', 'Paul', 24.7, 46.7, { confidence: 0.6 }), v('ovt-y', 'PAUL', 24.70005, 46.70005, { confidence: 0.9 }), v('ovt-z', 'Paul', 24.75, 46.7)]);
    expect(d.map((x) => x.id).sort()).toEqual(['ovt-y', 'ovt-z']);
  });
});

describe('venues-riyadh.json (combined)', () => {
  const file = JSON.parse(readFileSync(path.join(__dirname, '../data/venues-riyadh.json'), 'utf8')) as { counts: { total: number }; venues: Venue[] };
  it('has thousands of places from both sources with unique ids', () => {
    expect(file.venues.length).toBeGreaterThan(5000);
    expect(file.counts.total).toBe(file.venues.length);
    expect(new Set(file.venues.map((x) => x.id)).size).toBe(file.venues.length);
    expect(file.venues.some((x) => x.sources?.includes('overture'))).toBe(true);
    expect(file.venues.some((x) => x.sources?.includes('osm'))).toBe(true);
  });
  it('compact form round-trips', () => {
    const x = file.venues.find((y) => y.nameAr && y.cuisine)!;
    const back = fromCompact(toCompact(x));
    expect(back).toMatchObject({ id: x.id, name: x.name, nameAr: x.nameAr, kind: x.kind, cuisine: x.cuisine });
  });
});
