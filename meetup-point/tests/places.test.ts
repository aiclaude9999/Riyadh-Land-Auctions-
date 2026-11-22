import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { District } from '@/lib/districts';
import { searchPlaces, type Landmark } from '@/lib/places';

const read = (f: string) => JSON.parse(readFileSync(path.join(__dirname, '../data', f), 'utf8'));
const districts = read('riyadh-districts.json').districts as District[];
const landmarks = read('landmarks-riyadh.json').landmarks as Landmark[];
const first = (q: string) => searchPlaces(q, districts, landmarks)[0];

describe('starting-point search (test users Ahmed, Mariam)', () => {
  it('finds well-known areas that are not official districts', () => {
    expect(first('Al Batha')).toMatchObject({ type: 'landmark', en: 'Al Batha' });
    expect(first('البطحاء')?.en).toBe('Al Batha');
    expect(first('Hittin')?.en).toBe('Hittin');
  });
  it('finds malls and hotels by their usual names', () => {
    expect(first('Kingdom Centre')?.en).toMatch(/Kingdom.?Centre/);
    const kc = first('Kingdom Centre')!.center;
    expect(Math.abs(kc.lat - 24.711)).toBeLessThan(0.01); // the real tower, not a namesake elsewhere
    expect(first('Riyadh Park')?.en).toMatch(/Riyadh Park/);
    expect(first('Boulevard')?.en).toMatch(/Boulevard/);
    expect(searchPlaces('Four Seasons', districts, landmarks).some((h) => /Four Seasons/.test(h.en))).toBe(true);
  });
  it('still puts districts first when they match', () => {
    expect(first('narjes')).toMatchObject({ type: 'district', en: 'Al Narjis' });
    expect(first('olaya')).toMatchObject({ type: 'district' });
  });

  it('hides near-duplicates of the same building', () => {
    const hits = searchPlaces('Kingdom', districts, landmarks).filter((h) => h.type === 'landmark');
    const near = hits.filter((h) => Math.abs(h.center.lat - 24.7113) < 0.003 && Math.abs(h.center.lng - 46.6746) < 0.003 && h.type === 'landmark' && h.kind === 'mall');
    expect(near.length).toBe(1);
  });
});
