import { describe, expect, it } from 'vitest';
import type { Station } from '@/lib/metro';
import { DEFAULT_SCORING, pickCandidates, scoreVenues, searchArea, type Eta, type Traveller } from '@/lib/scoring';
import type { Venue } from '@/lib/venues';

const station: Station = { id: 's1', name_en: 'STC', name_ar: '', interchange: false, position: { lat: 24.7, lng: 46.7 }, lines: [{ ref: '1', name: 'Blue', color: '#00f', seq: 0 }] };
const venue = (id: string, lat: number, lng: number, extra: Partial<Venue> = {}): Venue => ({ id, name: id, kind: 'cafe', location: { lat, lng }, ...extra });
const car = (minutes: number): Eta => ({ minutes, source: 'api', walkMinutes: 0 });
const metro = (minutes: number, walk: number): Eta => ({ minutes, source: 'estimated', walkMinutes: walk });
const cars: Traveller[] = [
  { location: { lat: 24.6, lng: 46.6 }, mode: 'car' },
  { location: { lat: 24.8, lng: 46.8 }, mode: 'car' },
];
const far = (id: string) => venue(id, 24.9, 46.9); // > 400 m from the station → no bonus

describe('searchArea', () => {
  it('centroid of the people; radius = max(3 km, half the largest distance)', () => {
    const a = searchArea(cars, [station]);
    expect(a.center.lat).toBeCloseTo(24.7, 6);
    expect(a.center.lng).toBeCloseTo(46.7, 6);
    expect(a.radiusM).toBeGreaterThan(14_000); // people ~29.6 km apart
    expect(a.radiusM).toBeLessThan(15_500);
    expect(a.stations[0].station.id).toBe('s1');
  });

  it('never goes below 3 km and honours weights', () => {
    const close: Traveller[] = [
      { location: { lat: 24.7, lng: 46.7 }, mode: 'car', weight: 3 },
      { location: { lat: 24.704, lng: 46.7 }, mode: 'car', weight: 1 },
    ];
    const a = searchArea(close, [station]);
    expect(a.radiusM).toBe(3000);
    expect(a.center.lat).toBeCloseTo(24.701, 6);
  });
});

describe('pickCandidates', () => {
  it('takes venues near central stations first, then spreads the rest, max 40', () => {
    const many = Array.from({ length: 200 }, (_, i) => venue(`v${i}`, 24.66 + (i % 20) * 0.004, 46.66 + Math.floor(i / 20) * 0.008));
    const nearStation = venue('near', 24.701, 46.701);
    const outside = venue('outside', 25.5, 47.5);
    const area = searchArea(cars, [station]);
    const picked = pickCandidates([...many, nearStation, outside], area);
    expect(picked.length).toBe(DEFAULT_SCORING.maxCandidates);
    expect(picked.map((v) => v.id)).toContain('near');
    expect(picked.map((v) => v.id)).not.toContain('outside');
    expect(new Set(picked.map((v) => v.id)).size).toBe(picked.length);
  });
});

describe('scoreVenues', () => {
  it('primary = longest trip (minimax), not the shortest total', () => {
    const venues = [far('unfair'), far('fair')];
    const res = scoreVenues(venues, cars, [[car(5), car(40)], [car(22), car(24)]], [station]);
    expect(res.map((r) => r.venue.id)).toEqual(['fair', 'unfair']); // 24 < 40 even though 45 < 46
    expect(res[0]).toMatchObject({ rank: 1, maxEta: 24, worstPerson: 1, spreadMin: 2 });
  });

  it('ties on the longest trip are broken by the sum', () => {
    const res = scoreVenues([far('a'), far('b')], cars, [[car(30), car(20)], [car(30), car(10)]], [station]);
    expect(res[0].venue.id).toBe('b');
  });

  it('gives −3 min to venues within 400 m of a station', () => {
    const res = scoreVenues([far('far'), venue('atStation', 24.7015, 46.7)], cars, [[car(20), car(20)], [car(22), car(22)]], [station]);
    expect(res[0].venue.id).toBe('atStation'); // 22 − 3 = 19 < 20
    expect(res[0].nearStation).toMatchObject({ name: 'STC', bonusMin: 3 });
    expect(res[0].score).toBe(19);
  });

  it('counts metro walking 1.5× (heat factor)', () => {
    const people: Traveller[] = [cars[0], { location: { lat: 24.8, lng: 46.8 }, mode: 'metro' }];
    // venue a: metro 20 min with 10 walking → adjusted 25; venue b: metro 23 min, 2 walking → 24
    const res = scoreVenues([far('a'), far('b')], people, [[car(10), metro(20, 10)], [car(10), metro(23, 2)]], [station]);
    expect(res.map((r) => r.venue.id)).toEqual(['b', 'a']);
    expect(res[1].etas[1]).toMatchObject({ minutes: 20, adjusted: 25, source: 'estimated', mode: 'metro' });
    const noHeat = scoreVenues([far('a'), far('b')], people, [[car(10), metro(20, 10)], [car(10), metro(23, 2)]], [station], { ...DEFAULT_SCORING, heatFactor: 1 });
    expect(noHeat[0].venue.id).toBe('a');
  });

  it('preference bonus moves a liked place up and is reported', () => {
    const res = scoreVenues([far('a'), far('b')], cars, [[car(20), car(20)], [car(21), car(21)]], [station], DEFAULT_SCORING, (v) =>
      v.id === 'b' ? { bonusMin: 2, liked: ['coffee'], favourite: false } : { bonusMin: 0, liked: [], favourite: false },
    );
    expect(res[0].venue.id).toBe('b');
    expect(res[0].pref).toMatchObject({ liked: ['coffee'] });
    expect(res[1].pref).toBeUndefined();
  });

  it('skips venues someone cannot reach and returns at most 5', () => {
    const venues = Array.from({ length: 8 }, (_, i) => far(`v${i}`));
    const etas = venues.map((_, i) => (i === 0 ? [car(1), null] : [car(10 + i), car(10)]));
    const res = scoreVenues(venues, cars, etas, [station]);
    expect(res).toHaveLength(5);
    expect(res.map((r) => r.venue.id)).not.toContain('v0');
    expect(res.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});
