import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { districtAt, normalize, searchDistricts, shortAr, shortEn, type District } from '@/lib/districts';

const districts = (JSON.parse(readFileSync(path.join(__dirname, '../data/riyadh-districts.json'), 'utf8')) as { districts: District[] }).districts;
const names = (q: string) => searchDistricts(q, districts).map(shortEn);

describe('riyadh-districts.json', () => {
  it('has 189 named districts with boundaries', () => {
    expect(districts).toHaveLength(189);
    expect(districts.every((d) => d.name_ar && d.name_en && d.rings.length)).toBe(true);
  });
});

describe('searchDistricts', () => {
  it('finds a district by English or Arabic, with or without the article', () => {
    expect(names('Al Narjis')[0]).toBe('Al Narjis');
    expect(names('narjes')[0]).toBe('Al Narjis');
    expect(names('النرجس')[0]).toBe('Al Narjis');
    expect(names('نرجس')[0]).toBe('Al Narjis');
    expect(names('olaya')).toContain('Al Olaya');
  });
  it('lists prefix matches before others and caps the list', () => {
    expect(searchDistricts('a', districts)).toHaveLength(8);
    expect(searchDistricts('', districts)).toEqual([]);
  });
  it('normalizes Arabic letter variants', () => {
    expect(normalize('حي الأندلس')).toBe(normalize('الاندلس'));
    expect(normalize('مكة')).toBe(normalize('مكه'));
  });
  it('short names drop "Dist." and "حي"', () => {
    const d = districts.find((x) => x.name_en.includes('Narjis'))!;
    expect(shortEn(d)).toBe('Al Narjis');
    expect(shortAr(d)).toBe('النرجس');
  });
});

describe('districtAt', () => {
  it('a district centre lies in that district', () => {
    const d = districts.find((x) => x.name_en.includes('Narjis'))!;
    expect(districtAt(d.center, districts)?.id).toBe(d.id);
    expect(districtAt({ lat: 21.5, lng: 39.2 }, districts)).toBeUndefined();
  });
});
