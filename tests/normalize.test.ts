import { describe, it, expect } from 'vitest';
import { normalizeArabic, normalizeTitle, mapCategory, parseMoney, statusFromDates } from '@/lib/normalize';
import { classifyGeo, citiesInText, placeKey } from '@/lib/geo';
import { parseRiyadhLocal, parseUtcNaive, riyadhDayBounds } from '@/lib/time';

describe('arabic normalisation', () => {
  it('unifies letter variants and diacritics', () => {
    expect(normalizeArabic('مَزادُ أرضٍ بالرياضِ')).toBe(normalizeArabic('مزاد ارض بالرياض'));
    expect(normalizeArabic('مدينة')).toBe('مدينه');
    expect(normalizeArabic('٢٠٢٥')).toBe('2025');
  });
  it('drops generic words from titles', () => {
    expect(normalizeTitle('مزاد إلكتروني: أرض الملقا')).toBe(normalizeTitle('ارض الملقا'));
  });
  it('place keys match across languages / prefixes', () => {
    expect(placeKey('محافظة الخرج')).toBe(placeKey('الخرج'));
    expect(placeKey('Al Kharj')).toBe(placeKey('Kharj'));
  });
});

describe('category mapping', () => {
  it.each([
    ['مزاد أرض سكنية', 'real_estate'], ['مزاد سيارات', 'vehicle'], ['معدات ثقيلة', 'equipment'],
    ['سكراب كابلات', 'scrap'], ['خردة', 'scrap'], ['مقتنيات نادرة', 'collectible'], ['شيء آخر', 'other'],
  ])('%s → %s', (t, c) => expect(mapCategory(t)).toBe(c));
});

describe('money & status', () => {
  it('parses money and treats 0 as unavailable', () => {
    expect(parseMoney('12,500.00 ر.س')).toBe(12500);
    expect(parseMoney(0)).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
  it('derives status from dates', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(statusFromDates(new Date('2026-01-02'), null, now)).toBe('upcoming');
    expect(statusFromDates(new Date('2025-12-01'), new Date('2026-01-01T13:00:00Z'), now)).toBe('live');
    expect(statusFromDates(new Date('2025-12-01'), new Date('2026-01-01T11:00:00Z'), now)).toBe('ended');
  });
});

describe('time zone', () => {
  it('handles naive UTC and Riyadh local', () => {
    expect(parseUtcNaive('2026-11-09 07:00:00')?.toISOString()).toBe('2026-11-09T07:00:00.000Z');
    expect(parseRiyadhLocal('2026-11-11', '19:20:00')?.toISOString()).toBe('2026-11-11T16:20:00.000Z');
    const { start, end } = riyadhDayBounds(new Date('2026-11-10T22:30:00Z')); // 01:30 on the 11th in Riyadh
    expect(start.toISOString()).toBe('2026-11-10T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-11T21:00:00.000Z');
  });
});

describe('geo classification', () => {
  it('riyadh city', () => expect(classifyGeo({ cities: ['الرياض'] }).scope).toBe('riyadh_city'));
  it('english name', () => expect(classifyGeo({ cities: ['Riyadh'] }).scope).toBe('riyadh_city'));
  it('riyadh region towns', () => {
    for (const c of ['الخرج', 'الدرعية', 'المزاحمية', 'Al Kharj']) {
      const g = classifyGeo({ cities: [c] });
      expect(g.scope).toBe('riyadh_region');
      expect(g.hasRiyadhCity).toBe(false);
      expect(g.hasRiyadhRegion).toBe(true);
    }
  });
  it('other cities', () => expect(classifyGeo({ cities: ['جدة'] }).scope).toBe('other'));
  it('unknown without data', () => expect(classifyGeo({}).scope).toBe('unknown'));
  it('multi-location auction with a Riyadh asset', () => {
    const g = classifyGeo({ cities: ['جدة', 'الرياض'] });
    expect(g.scope).toBe('riyadh_city');
    expect(g.isMultiLocation).toBe(true);
  });
  it('district-only listings in Riyadh region', () => expect(classifyGeo({ regions: ['منطقة الرياض'], districts: ['حي الملقا'] }).scope).toBe('riyadh_city'));
  it('coordinates in Riyadh', () => expect(classifyGeo({ lat: 24.71, lng: 46.67 }).scope).toBe('riyadh_city'));
  it('finds cities in free text', () => {
    expect(citiesInText('مزاد سكراب كابلات مطار جده بالظرف المغلق')).toContain('جده');
    expect(citiesInText('البديعة والملقا، الرياض')).toContain('الرياض');
    expect(citiesInText('مزاد خيول عربية')).toEqual([]);
  });
});
