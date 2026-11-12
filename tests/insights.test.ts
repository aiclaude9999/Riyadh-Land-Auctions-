import { describe, it, expect } from 'vitest';
import { assetInsights, COST_RATE, findDistrict, haversineKm, nearestStation } from '@/lib/insights';

describe('asset insights (Riyadh)', () => {
  it('finds the district from a map point and from a name', () => {
    expect(findDistrict(24.5691, 46.6779)?.name).toBe('حي نمار'); // Nimar centroid
    expect(findDistrict(null, null, 'الشفاء')?.name).toBe('حي الشفا');
  });

  it('costs and distances', () => {
    expect(COST_RATE).toBeCloseTo(0.07875);
    expect(haversineKm(24.7, 46.7, 24.7, 46.7)).toBe(0);
    expect(haversineKm(24.7, 46.6, 24.7, 46.7)).toBeCloseTo(10.1, 0);
    expect(nearestStation(24.7, 46.7)?.km).toBeLessThan(3);
  });

  it('price check for a land plot in Nimar (median ≈ 1,2xx SAR/m²)', () => {
    const cheap = assetInsights({ propertyType: 'land', areaSqm: 600, startPrice: 300_000, geoScope: 'riyadh_city', latitude: 24.5691, longitude: 46.6779 })!;
    expect(cheap.district).toBe('نمار');
    expect(cheap.benchPpm).toBeGreaterThan(500);
    expect(cheap.plotPpm).toBe(500);
    expect(cheap.verdict).toBe('below');
    expect(cheap.maxBid).toBe(Math.round((cheap.benchPpm! * 600) / (1 + COST_RATE) / 1000) * 1000);
    const dear = assetInsights({ propertyType: 'land', areaSqm: 600, startPrice: 5_000_000, geoScope: 'riyadh_city', latitude: 24.5691, longitude: 46.6779 })!;
    expect(dear.verdict).toBe('above');
  });

  it('no price → only a suggested max bid; big land → white-land warning; outside Riyadh → nothing', () => {
    const r = assetInsights({ propertyType: 'land', areaSqm: 6000, startPrice: null, geoScope: 'riyadh_city', latitude: 24.5691, longitude: 46.6779 })!;
    expect(r.verdict).toBeUndefined();
    expect(r.maxBid).toBeGreaterThan(0);
    expect(r.whiteLand).toBe(true);
    expect(assetInsights({ propertyType: 'villa', areaSqm: 400, geoScope: 'riyadh_city', latitude: 24.5691, longitude: 46.6779 })?.benchPpm).toBeUndefined();
    expect(assetInsights({ propertyType: 'land', areaSqm: 600, startPrice: 1, geoScope: 'other', latitude: 26.4, longitude: 50.1 })).toBeNull();
  });
});
