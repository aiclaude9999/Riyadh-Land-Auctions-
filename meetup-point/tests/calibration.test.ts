import { describe, expect, it } from 'vitest';
import { addReport, factorFrom, getCalibration } from '@/lib/calibration.server';
import { memoryStore } from '@/lib/store.server';

describe('learning from real trip times', () => {
  it('needs 5 reports, uses the median, and stays within ×0.75–×1.4', async () => {
    expect(factorFrom([1.3, 1.3])).toBe(1);
    expect(factorFrom([1.1, 1.2, 1.3, 1.2, 5])).toBe(1.2);
    expect(factorFrom([3, 3, 3, 3, 3])).toBe(1.4);
    const store = memoryStore();
    for (const [e, a] of [[20, 26], [30, 36], [10, 13], [40, 48], [25, 30]]) expect(await addReport(store, 'car', e, a)).toBe(true);
    expect(await addReport(store, 'bike', 10, 10)).toBe(false);
    expect(await addReport(store, 'car', 10, 9999)).toBe(false);
    const c = await getCalibration(store);
    expect(c.car).toBeCloseTo(1.2, 2);
    expect(c.metro).toBe(1);
    expect(c.reports).toEqual({ car: 5, metro: 0 });
  });
});
