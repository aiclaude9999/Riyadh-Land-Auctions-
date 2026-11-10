import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseInfathList, parseInfathDetail, parseArabicDate } from '@/connectors/infath';
import { toListingData } from '@/lib/ingest';

// Real page captured from a Saudi network on 2026-11-10 (infath.gov.sa/ar/auctions/?tab=ongoing)
const html = readFileSync(join(__dirname, 'fixtures', 'infath-ongoing.html'), 'utf8');

describe('infath list page', () => {
  const items = parseInfathList(html, 'ongoing');
  it('reads every auction card', () => {
    expect(items).toHaveLength(9);
    items.forEach((a) => expect(a.url).toMatch(/^https:\/\/infath\.gov\.sa\/ar\/auction\?AuctionId=\d+$/));
  });
  it('maps name, status, location and exact closing time', () => {
    const a = items.find((x) => x.externalId === '613')!;
    expect(a.title).toBe('مزاد بركة الشرقية');
    expect(a.status).toBe('live');
    expect(a.city).toBe('الدمام');
    expect(a.region).toBe('المنطقة الشرقية');
    expect(a.endAt?.toISOString()).toBe('2026-11-10T16:30:00.000Z'); // 19:30 Riyadh from the countdown
    expect(a.startAt?.toISOString()).toBe('2026-11-08T07:00:00.000Z'); // "10:00:00" → 10:00 Riyadh
    expect(a.crossRefs).toEqual(['infath:613']);
  });
  it('treats "متعدد المدن" as unknown city, not a city name', () => {
    items.filter((a) => (a.raw as any).multiCity).forEach((a) => expect(a.city).toBeNull());
  });
  it('classifies vehicle auctions by their title', () => {
    expect(items.find((x) => x.externalId === '574')!.category).toBe('vehicle'); // مركبة حائل
    expect(items.find((x) => x.externalId === '651')!.category).toBe('real_estate'); // بيوت الرياض
  });
  it('produces valid listing data', () => {
    items.forEach((a) => expect(['live', 'upcoming', 'ended']).toContain(toListingData(a).status));
  });
});

describe('infath helpers', () => {
  it('parses Arabic dates', () => {
    expect(parseArabicDate('08 نوفمبر 2026   10:00:00')).toEqual({ date: '2026-11-08', time: '10:00:00' });
    expect(parseArabicDate('٠٢ فبراير ٢٠٢٦')).toEqual({ date: '2026-02-02', time: null });
  });
  it('reads assets from a detail page by their labels', () => {
    const detail = `<div class="asset"><h4>رقم الأصل</h4><p>1</p><h4>نوع الأصل</h4><p>أرض</p><h4>المساحة</h4><p>2,624.00 م²</p>
      <h4>المدينة</h4><p>الدمام</p><h4>الحي</h4><p>حي المزروعية</p><h4>سعر البداية</h4><p>1,000,000 ريال</p><a href="https://mobasher.sa/auctions/613">رابط</a></div>
      <div class="asset"><h4>رقم الأصل</h4><p>2</p><h4>نوع الأصل</h4><p>أرض</p><h4>المساحة</h4><p>1,328.00 م²</p><h4>المدينة</h4><p>الدمام</p></div>`;
    const as = parseInfathDetail(detail, 'https://infath.gov.sa/ar/auction?AuctionId=613');
    expect(as).toHaveLength(2);
    expect(as[0]).toMatchObject({ externalId: '1', propertyType: 'land', areaSqm: 2624, city: 'الدمام', district: 'المزروعية', startPrice: 1000000, url: 'https://mobasher.sa/auctions/613' });
    expect(as[1].areaSqm).toBe(1328);
  });
});
