import { describe, it, expect } from 'vitest';
import { findAuctionArrays, mapHeuristic } from '@/connectors/heuristic';

describe('generic JSON auction mapper', () => {
  const doc = { data: { items: [
    { id: 7, title: 'مزاد أرض تجارية', startDate: '2026-11-10T07:00:00Z', endDate: '2026-11-12T13:00:00Z', city: 'الرياض', startPrice: '150000' },
    { id: 8, title: 'مزاد معدات', start_at: '2026-11-11 08:00:00', end_at: '2026-11-13 12:00:00' },
  ], meta: { total: 2 } } };
  it('finds auction-like arrays', () => {
    expect(findAuctionArrays(doc)[0]).toHaveLength(2);
    expect(findAuctionArrays({ menu: [{ id: 1, name: 'home' }] })).toEqual([]);
  });
  it('maps only fields that exist', () => {
    const a = mapHeuristic(doc.data.items[0], (id) => `https://x/${id}`);
    expect(a).toMatchObject({ externalId: '7', url: 'https://x/7', category: 'real_estate', city: 'الرياض', startPrice: 150000 });
    expect(a.deposit).toBeNull();
    const b = mapHeuristic(doc.data.items[1], (id) => `https://x/${id}`);
    expect(b.category).toBe('equipment');
    expect(b.endAt?.toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });
});
