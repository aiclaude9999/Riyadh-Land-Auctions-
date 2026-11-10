import { describe, it, expect } from 'vitest';
import { findBestMatch, matchScore, tokenSimilarity, type DedupRecord } from '@/lib/dedup';
import { normalizeTitle, normalizeOrganizer } from '@/lib/normalize';
import { auctionFieldsFrom } from '@/lib/ingest';

const rec = (p: Partial<DedupRecord> & { title: string; src: string }): DedupRecord => ({
  sourceIds: [p.src], normalizedTitle: normalizeTitle(p.title), normalizedOrganizer: p.normalizedOrganizer ?? null,
  category: p.category ?? 'real_estate', startAt: p.startAt ?? new Date('2026-11-10T07:00:00Z'), endAt: p.endAt ?? new Date('2026-11-12T13:00:00Z'),
  cities: p.cities ?? ['الرياض'], assetCount: p.assetCount ?? null, crossRefs: p.crossRefs ?? [],
});

describe('dedup engine', () => {
  const infath = rec({ src: 'infath', title: 'مزاد إنفاذ - أرض سكنية بحي الملقا', normalizedOrganizer: normalizeOrganizer('شركة كانف العقارية'), assetCount: 3 });

  it('merges the same auction re-published on another platform', () => {
    const mob = rec({ src: 'mobasher', title: 'أرض سكنية بحي الملقا - مزاد إنفاذ', normalizedOrganizer: normalizeOrganizer('كانف العقارية'), assetCount: 3, endAt: new Date('2026-11-12T14:00:00Z') });
    expect(matchScore(mob, infath).score).toBeGreaterThanOrEqual(0.78);
    expect(findBestMatch(mob, [infath])).toBe(infath);
  });

  it('matches on shared cross-reference ids regardless of title', () => {
    const a = rec({ src: 'athmann', title: 'شيء مختلف تماماً', crossRefs: ['infath:INF-123'] });
    expect(matchScore(a, { ...infath, crossRefs: ['infath:INF-123'] }).score).toBe(1);
  });

  it('never merges two listings from the same source', () => {
    const other = rec({ src: 'infath', title: 'مزاد إنفاذ - أرض سكنية بحي الملقا' });
    expect(matchScore(other, infath).score).toBe(0);
  });

  it('keeps auctions with similar names but different dates apart', () => {
    const later = rec({ src: 'mobasher', title: 'أرض سكنية بحي الملقا', endAt: new Date('2026-12-20T13:00:00Z'), startAt: new Date('2026-12-18T07:00:00Z') });
    expect(matchScore(later, infath).score).toBe(0);
  });

  it('keeps auctions in different cities apart', () => {
    const jeddah = rec({ src: 'mobasher', title: 'مزاد إنفاذ - أرض سكنية بحي الملقا', cities: ['جدة'] });
    expect(matchScore(jeddah, infath).score).toBe(0);
  });

  it('keeps generic titles from different organisers apart', () => {
    const a = rec({ src: 'mobasher', title: 'مزاد سيارات', category: 'vehicle', normalizedOrganizer: normalizeOrganizer('شركة أ') });
    const b = rec({ src: 'mazadat', title: 'مزاد سيارات متنوعة', category: 'vehicle', normalizedOrganizer: normalizeOrganizer('مؤسسة ب') });
    expect(matchScore(a, b).score).toBe(0);
  });

  it('does not merge when neither date is known', () => {
    const a = { ...rec({ src: 'a', title: 'مزاد لوحات مميزة' }), startAt: null, endAt: null };
    const b = { ...rec({ src: 'b', title: 'مزاد لوحات مميزة' }), startAt: null, endAt: null };
    expect(matchScore(a, b).score).toBe(0);
  });

  it('token similarity basics', () => {
    expect(tokenSimilarity('ارض الملقا', 'ارض الملقا')).toBe(1);
    expect(tokenSimilarity('ارض الملقا', 'سياره كامري')).toBe(0);
  });
});

describe('merge of listings into one auction', () => {
  it('unions cities/images and marks multi-location + Riyadh', () => {
    const base = { title: 'x', normalizedTitle: 'x', category: 'real_estate', status: 'upcoming', startAt: null, endAt: null, region: null, city: null, district: null, locationText: null, assetCount: null, startPrice: null, currentPrice: null, deposit: null, organizer: null, normalizedOrganizer: null };
    const m = auctionFieldsFrom([
      { ...base, cities: ['جدة'], images: ['a.jpg'], status: 'live', currentPrice: 1000 },
      { ...base, cities: ['الرياض'], images: ['a.jpg', 'b.jpg'], organizer: 'جهة' },
    ]);
    expect(m.cities).toEqual(['جدة', 'الرياض']);
    expect(m.images).toEqual(['a.jpg', 'b.jpg']);
    expect(m.isMultiLocation).toBe(true);
    expect(m.hasRiyadhCity).toBe(true);
    expect(m.status).toBe('live');
    expect(m.organizer).toBe('جهة');
    expect(Number(m.currentPrice)).toBe(1000);
  });
});
