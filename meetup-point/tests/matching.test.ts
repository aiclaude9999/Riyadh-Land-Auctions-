import { describe, expect, it } from 'vitest';
import { rankStyles, tasteMatch } from '@/lib/matching';
import { isOpen } from '@/lib/openingHours';
import { EMPTY_PREFS } from '@/lib/preferences';
import type { ScoredVenue } from '@/lib/scoring';
import type { Venue } from '@/lib/venues';

const v = (id: string, extra: Partial<Venue> = {}): Venue => ({ id, name: id, kind: 'restaurant', location: { lat: 24.7, lng: 46.7 }, ...extra });

describe('opening hours', () => {
  // day: 0 = Sunday … 5 = Friday
  it('reads simple rules, past-midnight ranges and 24/7', () => {
    expect(isOpen('24/7', 3, 200)).toBe(true);
    expect(isOpen('Mo-Su 17:00-01:00', 2, 18 * 60)).toBe(true);
    expect(isOpen('Mo-Su 17:00-01:00', 3, 30)).toBe(true); // 00:30 the next day
    expect(isOpen('Mo-Su 17:00-01:00', 3, 12 * 60)).toBe(false);
    expect(isOpen('Sa-Th 09:00-03:00; Fr 14:00-03:00', 5, 10 * 60)).toBe(false); // Friday morning
    expect(isOpen('Sa-Th 09:00-03:00; Fr 14:00-03:00', 5, 15 * 60)).toBe(true);
  });
  it('unknown formats are unknown, not closed', () => {
    expect(isOpen('2pm to 12pm', 1, 600)).toBeNull();
    expect(isOpen(undefined, 1, 600)).toBeNull();
  });
});

describe('taste match', () => {
  it('counts who it suits, who loves it and who avoids it', () => {
    const pizza = v('p', { cuisine: 'pizza' });
    const m = tasteMatch(pizza, [{ likes: ['italian'] }, { avoids: ['italian'] }, {}], null, EMPTY_PREFS);
    expect(m).toMatchObject({ fits: 2, loves: 1, against: 1, people: 3 });
    const fav = tasteMatch(pizza, [{ likes: ['italian'] }], 100, { ...EMPTY_PREFS, favourites: ['p'] });
    expect(fav.score).toBeGreaterThan(m.score);
    expect(fav.score).toBeLessThanOrEqual(100);
  });
});

describe('three rankings', () => {
  const sv = (id: string, maxEta: number, sumEta: number, matchScore: number, against = 0) =>
    ({ venue: v(id), maxEta, sumEta, score: maxEta, match: { fits: 1, loves: 0, against, people: 1, score: matchScore } }) as unknown as ScoredVenue & { match: ReturnType<typeof tasteMatch> };
  it('fair keeps the score order, quick sorts by total, best = highest place score within a fair trip', () => {
    const list = [sv('a', 30, 50, 40), sv('b', 32, 40, 90), sv('c', 33, 60, 95, 1), sv('d', 60, 70, 100)];
    const s = rankStyles(list, 3);
    expect(s.fair).toEqual(['a', 'b', 'c']);
    expect(s.quick[0]).toBe('b');
    expect(s.best[0]).toBe('b'); // c is avoided by someone, d is far too long
    expect(s.best).not.toContain('d');
  });
});
