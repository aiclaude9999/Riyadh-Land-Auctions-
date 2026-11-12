import { describe, it, expect } from 'vitest';
import { featuresLabel, plotFeatures, streetWidthOf } from '@/lib/plot';

describe('plot features from deed boundaries', () => {
  it('Mobasher boundaries (real): corner, 2 streets, widest 20 m', () => {
    const f = plotFeatures({ NORTH: 'قطعة رقم 1/164 بطول 35.2م', SOUTH: 'شارع عرض 20م بطول 35م', EAST: 'قطعة رقم 163 بطول 23.74م', WEST: 'شارع عرض 18م بطول 19.82م' });
    expect(f).toEqual({ streetSides: 2, streetWidth: 20, corner: true });
    expect(featuresLabel(f!)).toBe('زاوية · واجهتان · أعرض شارع 20 م');
  });
  it('one street, no corner', () => {
    expect(plotFeatures({ NORTH: 'شارع عرض 15م بطول 20م', SOUTH: 'قطعة رقم 378', EAST: 'قطعة 375', WEST: 'قطعة 379' })).toEqual({ streetSides: 1, streetWidth: 15, corner: false });
  });
  it('Infath platform boundaries (real): east + west streets, no widths', () => {
    expect(plotFeatures({ NorthLimitName: 'ملك الغير ', SouthLimitName: 'ملك الغير ', EastLimitName: 'شارع ', WestLimitName: 'شارع ' })).toEqual({ streetSides: 2, streetWidth: null, corner: false });
    expect(plotFeatures({ NorthLimitName: 'Land', SouthLimitName: 'Land', EastLimitName: 'Land', WestLimitName: 'Land' })).toEqual({ streetSides: 0, streetWidth: null, corner: false });
    expect(plotFeatures({ foo: 'bar' })).toBeNull();
  });
  it('street widths', () => {
    expect(streetWidthOf('شارع بعرض 30 م')).toBe(30);
    expect(streetWidthOf('شارع')).toBeNull();
  });
});
