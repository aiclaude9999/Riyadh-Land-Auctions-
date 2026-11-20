import { describe, expect, it } from 'vitest';
import { venueGroups } from '@/lib/cuisine';
import { allowedByPrefs, EMPTY_PREFS, prefBonus, sanitizePrefs } from '@/lib/preferences';
import type { Venue } from '@/lib/venues';

const v = (id: string, extra: Partial<Venue>): Venue => ({ id, name: id, kind: 'restaurant', location: { lat: 24.7, lng: 46.7 }, ...extra });

describe('venueGroups', () => {
  it('maps OSM cuisine tags to food groups; plain cafés count as coffee', () => {
    expect(venueGroups(v('a', { cuisine: 'pizza' }))).toEqual(['italian']);
    expect(venueGroups(v('b', { cuisine: 'regional, burger' }))).toEqual(['arabic', 'burger']);
    expect(venueGroups(v('c', { kind: 'cafe' }))).toEqual(['coffee']);
    expect(venueGroups(v('d', {}))).toEqual([]);
  });
});

describe('preferences', () => {
  it('sanitize keeps only known groups and string ids, without duplicates', () => {
    expect(sanitizePrefs({ likes: ['coffee', 'coffee', 'nope'], avoids: 5, favourites: ['x', 7, 'x'], hidden: null })).toEqual({ likes: ['coffee'], avoids: [], favourites: ['x'], hidden: [] });
    expect(sanitizePrefs(undefined)).toEqual(EMPTY_PREFS);
  });
  it('hidden places and places serving only avoided food are dropped', () => {
    const p = { ...EMPTY_PREFS, avoids: ['burger' as const], hidden: ['h'] };
    expect(allowedByPrefs(v('h', {}), p)).toBe(false);
    expect(allowedByPrefs(v('b', { cuisine: 'burger' }), p)).toBe(false);
    expect(allowedByPrefs(v('mix', { cuisine: 'burger, pizza' }), p)).toBe(true); // also serves something else
    expect(allowedByPrefs(v('unknown', {}), p)).toBe(true); // no cuisine info → keep
  });
  it('bonus: −2 for liked food, −3 for a favourite', () => {
    const p = { ...EMPTY_PREFS, likes: ['coffee' as const], favourites: ['fav'] };
    expect(prefBonus(v('x', { kind: 'cafe' }), p)).toEqual({ bonusMin: 2, liked: ['coffee'], favourite: false });
    expect(prefBonus(v('fav', { kind: 'cafe' }), p).bonusMin).toBe(5);
    expect(prefBonus(v('y', { cuisine: 'pizza' }), p).bonusMin).toBe(0);
  });
});
