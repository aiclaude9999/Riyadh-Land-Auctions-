import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { areaFromName, districtFromName, groupItems, isRiyadhItem, parseDetail, toAsset, utc } from '@/connectors/infath-auctions';
import { toListingData } from '@/lib/ingest';

// Real answers from api.infath.gov.sa (auctions platform), captured from a Saudi network on 2026-11-12, trimmed
const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', f), 'utf8'));
const list = fx('infath-platform-list.json').data.items;
const villa = parseDetail(fx('infath-platform-item-villa.json').data);
const twoPlots = parseDetail(fx('infath-platform-item-2plots.json').data);

describe('infath auctions platform', () => {
  it('reads names: district and area', () => {
    expect(districtFromName('ثروة الرياض-فيلا سكنية بحي الشفا')).toBe('الشفا');
    expect(districtFromName('ثروة الرياض- أرض سكنية بحي عريض الرياض')).toBe('عريض');
    expect(districtFromName('ثروة الرياض-قطعتين أرض تجارية بحي الصناعية الرياض')).toBe('الصناعية');
    expect(districtFromName('عمارة سكنية - حي الصفا')).toBe('الصفا');
    expect(districtFromName('منارات بريدة ، فيلا سكني في حي الرحاب بمساحة 288 م٢ بمدينة بريدة')).toBe('الرحاب');
    expect(districtFromName('أرض سكنية - حي خارج حدود الأحياء')).toBeNull();
    expect(districtFromName('فندق العدامة')).toBeNull();
    expect(areaFromName('كنوز الشرقية - شقة سكنية بالدمام بمساحة 226.92 م٢')).toBe(226.92);
    expect(utc('2026-12-07T16:40:00')?.toISOString()).toBe('2026-12-07T16:40:00.000Z');
  });

  it('reads deed sections from item details', () => {
    expect(villa.plots).toHaveLength(1);
    expect(villa.plots[0]).toMatchObject({ PropertyType: 'فيلا سكني', TypeOfPropertyDeed: 'سكني', City: 'الرياض', Area: '500' });
    expect(twoPlots.plots.map((p) => p.Area)).toEqual(['3500', '3168.9']);
  });

  it('finds Riyadh items (city missing → name / location)', () => {
    expect(list.filter(isRiyadhItem).map((x: any) => x.id)).toHaveLength(4);
  });

  it('builds assets: undetermined price → null, area from deeds, district from name', () => {
    const a = toAsset(list[0], villa);
    expect(a).toMatchObject({ propertyType: 'villa', usage: 'residential', areaSqm: 500, district: 'الشفا', city: 'الرياض', region: 'الرياض',
      startPrice: null, deposit: 30000, status: 'upcoming', url: 'https://auctions.infath.gov.sa/auctions/fd02a478-c2b3-4a27-9d08-454c45b74ec0' });
    expect(a.latitude).toBeCloseTo(24.5789);
    const b = toAsset(list[1], twoPlots);
    expect(b).toMatchObject({ propertyType: 'land', usage: 'commercial', areaSqm: 6668.9, district: 'الصناعية', deposit: 300000 });
    expect(b.title).toContain('(2 صكوك)');
    expect(b.notes).toBe('صك 8979313901700000 · النوع: ارض مسورة تجاري · بلوك 2520 · 3500 م²\nصك 8935876849100000 · النوع: ارض مسورة تجاري · بلوك 2520 · 3168.9 م²');
    expect(b.description).toBeNull();
    const dammam = toAsset(list[4]); // no detail request outside Riyadh
    expect(dammam).toMatchObject({ propertyType: 'apartment', areaSqm: 226.92, startPrice: 412000, city: 'الدمام', region: 'المنطقة الشرقية' });
  });

  it('groups items of one auction by reference id', () => {
    const auctions = groupItems(list, new Map([[list[0].id, villa], [list[1].id, twoPlots]]));
    const riyadh = auctions.find((a) => a.externalId === 'A-47105-2611-0060')!;
    expect(riyadh).toMatchObject({ title: 'ثروة الرياض', category: 'real_estate', status: 'upcoming', assetCount: 4, crossRefs: ['infath-ref:A-47105-2611-0060'] });
    expect(riyadh.startAt?.toISOString()).toBe('2026-12-03T05:00:00.000Z');
    expect(riyadh.endAt?.toISOString()).toBe('2026-12-07T17:00:00.000Z');
    expect(riyadh.assets).toHaveLength(4);
    const listing = toListingData(riyadh);
    expect(listing.geo.scope).toBe('riyadh_city');
  });
});
