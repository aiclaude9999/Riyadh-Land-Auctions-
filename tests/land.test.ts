import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapPropertyType, mapUsage } from '@/lib/normalize';
import { parseMobasherProduct } from '@/connectors/mobasher';
import { parseSaudiaProduct } from '@/connectors/saudia-auctions';
import { propertySummary } from '@/lib/ingest';

const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', f), 'utf8'));

describe('property type / usage', () => {
  it.each([
    ['أرض بحي الصواري بصك 730217002601', 'land'], ['ارض سكنية', 'land'], ['أراضي مخطط الواحة', 'land'], ['Land', 'land'],
    ['فيلا', 'villa'], ['قصر بحي الرمال', 'villa'], ['شقة', 'apartment'], ['عمارة سكنية', 'building'],
    ['استراحة', 'rest_house'], ['منتجع سياحي', 'rest_house'], ['مزرعة', 'farm'], ['محلات تجارية', 'commercial'],
  ])('%s → %s', (t, e) => expect(mapPropertyType(t)).toBe(e));
  it('does not match "أرض" inside other words', () => expect(mapPropertyType('مزاد الأرضية')).toBeNull());
  it.each([['سكني', 'residential'], ['أرض زراعية', 'agricultural'], ['Commercial', 'commercial'], ['سكني تجاري', 'mixed'], ['أرض متعددة الاستخدام بحي العارض', 'mixed']])('%s → %s', (t, e) => expect(mapUsage(t)).toBe(e));
});

describe('mobasher products (real fixture)', () => {
  const ps = fx('mobasher-products.json').items.map((p: any) => parseMobasherProduct(p, 'https://mobasher.sa/x'));
  it('reads land type, usage, area, opening price, deposit and coordinates', () => {
    expect(ps[0]).toMatchObject({ propertyType: 'land', usage: 'residential', areaSqm: 755.64, startPrice: 1340000, deposit: 50000, city: 'الخبر' });
    expect(ps[0].latitude).toBeCloseTo(26.188, 2);
  });
});

describe('saudia products (real fixture)', () => {
  const list = fx('saudia-products.json').data.product_list;
  const ps = list.map((p: any) => parseSaudiaProduct(p, 'https://x', { lat: 24.7, lng: 46.6 }));
  it('maps name to type and keeps area/deposit/opening price', () => {
    expect(ps.map((p: any) => p.propertyType)).toEqual(['villa', 'villa', 'rest_house', 'rest_house', 'land']);
    expect(ps[0]).toMatchObject({ areaSqm: 600, deposit: 100000, startPrice: 4000000, latitude: 24.7 });
    expect(ps[4].usage).toBe('residential');
    expect(parseSaudiaProduct({ id: 1, name: 'عمارة تجارية سكنية بحي الدار البيضاء' }, 'u').district).toBe('الدار البيضاء');
  });
});

describe('land summary', () => {
  const a = (propertyType: string | null, areaSqm: number | null, startPrice: number | null = null) => ({ propertyType, usage: null, areaSqm, startPrice, deposit: null });
  it('counts land plots and sums their area only', () => {
    const s = propertySummary('real_estate', 'مزاد', [a('land', 500, 900000), a('land', 250.5, 400000), a('villa', 600, 2000000)]);
    expect(s).toMatchObject({ hasLand: true, landCount: 2, landAreaSqm: 750.5, minAssetPrice: 400000 });
    expect(s.propertyTypes).toEqual(['land', 'villa']);
  });
  it('no land plots → hasLand false', () => expect(propertySummary('real_estate', 'x', [a('villa', 300)]).hasLand).toBe(false));
  it('falls back to the title when assets are unknown', () => {
    const s = propertySummary('real_estate', 'مزاد أراضي حي الملقا', []);
    expect(s.hasLand).toBe(true);
    expect(s.landCount).toBeNull();
  });
  it('vehicles never become land', () => expect(propertySummary('vehicle', 'أرض', []).hasLand).toBe(false));
});
