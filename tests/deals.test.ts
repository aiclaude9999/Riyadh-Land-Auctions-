import { describe, expect, it } from 'vitest';
import { districtKey, isEstimatedLand, makeLocator, median, parseCsv, parseMojCsv, pricePerSqm, ringCentroid, summariseDeals } from '@/lib/deals';

// trimmed real rows from the MoJ 2026-Q2 / Q3 sales files (Q3 uses different date-column names)
const Q2 = `﻿المنطقة,المدينة,المدينة / الحي,الرقم المرجعي للصفقة,التاريخ الميلادي,التاريخ الهجري,تصنيف العقار,عدد العقارات,السعر,المساحة
منطقة مكة المكرمه,الطائف,الطائف/ الكدى ,35983585,2026/04/01,1447/10/13,سكني,1,"1,000,000",593.75
منطقة الرياض,الرياض,الرياض/نمار ,1,2026/04/02,1447/10/14,سكني,1,"750,000",500.00
منطقة الرياض,الرياض,الرياض/نمار ,2,2026/04/03,1447/10/15,سكني,1,"1,000,000",400.00
منطقة الرياض,الرياض,الرياض/نمار ,3,2026/04/04,1447/10/16,تجاري,1,"3,000,000",1000.00
منطقة الرياض,الرياض,الرياض/الصفاء ,4,2026/04/05,1447/10/17,سكني,1,"680,701",170.24
منطقة الرياض,الرياض,الرياض/النسيم ,5,2026/04/05,1447/10/17,سكني,2,"900,000",300.00
منطقة الرياض,الرياض,الرياض/شرق الرياض ,6,2026/04/05,1447/10/17,سكني,1,"900,000",300.00
`;
const Q3 = `﻿المنطقة,المدينة,المدينة / الحي,الرقم المرجعي للصفقة,تاريخ الصفقة ميلادي,تاريخ الصفقة هجري,تصنيف العقار,عدد العقارات,السعر,المساحة
منطقة الرياض,الرياض,الرياض/ هيت الجنوبى ,37822119,2026/07/01,1448/01/16,تجاري,1,13000000.0,40000.0
`;
const POINTS = [
  { name: 'حي نمار', lat: 24.57, lng: 46.68 },
  { name: 'حي الصفا', lat: 24.66, lng: 46.75 },
  { name: 'حي النسيم الشرقي', lat: 24.72, lng: 46.84 },
  { name: 'حي النسيم الغربي', lat: 24.74, lng: 46.80 },
];

describe('MoJ deals', () => {
  it('parses quoted CSV and both header variants', () => {
    expect(parseCsv('a,"b,c",""\n1,"x ""y""",3')).toEqual([['a', 'b,c', ''], ['1', 'x "y"', '3']]);
    const q2 = parseMojCsv(Q2);
    expect(q2).toHaveLength(7);
    expect(q2[1]).toMatchObject({ city: 'الرياض', district: 'نمار', classification: 'سكني', properties: 1, price: 750000, area: 500 });
    expect(parseMojCsv(Q3)[0]).toMatchObject({ district: 'هيت الجنوبى', price: 13000000, area: 40000 });
  });

  it('matches district spellings', () => {
    expect(districtKey('الصفاء')).toBe(districtKey('حي الصفا'));
    expect(districtKey('المعيزلة')).toBe(districtKey('المعيزله'));
    const loc = makeLocator(POINTS);
    expect(loc('نمار')).toMatchObject({ name: 'نمار', lat: 24.57 });
    const nas = loc('النسيم')!; // average of east + west
    expect(nas.lat).toBeCloseTo(24.73);
    expect(nas.lng).toBeCloseTo(46.82);
    expect(loc('شرق الرياض')).toBeNull();
  });

  it('price per m², land estimate, median', () => {
    expect(pricePerSqm({ region: '', city: '', district: '', classification: 'سكني', properties: 1, price: 750000, area: 500 })).toBe(1500);
    expect(pricePerSqm({ region: '', city: '', district: '', classification: 'سكني', properties: 1, price: 5000, area: 500 })).toBeNull();
    expect(isEstimatedLand({ region: '', city: '', district: '', classification: 'سكني', properties: 1, price: 1, area: 201 })).toBe(true);
    expect(isEstimatedLand({ region: '', city: '', district: '', classification: 'تجاري', properties: 1, price: 1, area: 900 })).toBe(false);
    expect(isEstimatedLand({ region: '', city: '', district: '', classification: 'سكني', properties: 1, price: 1, area: 170 })).toBe(false);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('summarises Riyadh-city districts per quarter and overall', () => {
    const d = summariseDeals([{ q: '2026-Q2', rows: parseMojCsv(Q2) }, { q: '2026-Q3', rows: parseMojCsv(Q3) }], POINTS);
    expect(d.quarters).toEqual([{ q: '2026-Q2', riyadhDeals: 6, mapped: 5 }, { q: '2026-Q3', riyadhDeals: 1, mapped: 0 }]);
    const nimar = d.rows.find((r) => r.q === '2026-Q2' && r.d === 'نمار')!;
    expect(nimar).toMatchObject({ n: 3, v: 4750000, m: 2500, nl: 2, ml: 2000, nr: 2, nc: 1 });
    expect(d.rows.find((r) => r.q === 'all' && r.d === 'نمار')?.n).toBe(3);
    expect(d.rows.find((r) => r.d === 'الصفا')).toMatchObject({ nl: 0, m: 3998 });
    expect(d.unmapped).toContainEqual({ q: '2026-Q3', d: 'هيت الجنوبى', n: 1 });
    expect(d.unmapped).toContainEqual({ q: '2026-Q2', d: 'شرق الرياض', n: 1 });
  });

  it('polygon centroid', () => {
    const c = ringCentroid([[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]);
    expect(c.lat).toBeCloseTo(1);
    expect(c.lng).toBeCloseTo(1);
  });
});
