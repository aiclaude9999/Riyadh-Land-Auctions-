import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseInfathList, parseInfathDetail, parseArabicDate, districtFromText, coordsFromMapsUrl, lastPageNumber } from '@/connectors/infath';
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
  it('reads assets from a real detail page (AuctionId=595, trimmed)', () => {
    const html = readFileSync(join(__dirname, 'fixtures/infath-detail.html'), 'utf8');
    const as = parseInfathDetail(html, 'https://infath.gov.sa/ar/auction/?AuctionId=595');
    expect(as).toHaveLength(4);
    expect(as[0]).toMatchObject({
      externalId: '1605229656900000', propertyType: 'villa', areaSqm: 560, deposit: 50000, city: 'الرياض', district: 'ظهرة لبن',
      startPrice: null, url: 'https://infath.gov.sa/ar/auction/?AuctionId=595', mapUrl: 'https://maps.app.goo.gl/96rDXdRpeHEhFk5A7',
    });
    expect(as[0].title).toMatch(/^فيلا — حي ظهرة لبن \(دور ارضي/);
    expect(as[2]).toMatchObject({ propertyType: 'land', usage: 'residential', areaSqm: 400, title: 'أرض سكنية — حي ظهرة لبن' });
    expect(as[3]).toMatchObject({ propertyType: 'land', areaSqm: 450, deposit: 15000, district: 'ضاحية نمار' });
    expect(as[0].description).toMatch(/^تفاصيل العقار: دور ارضي/);
    expect(as[0].notes).toBeNull();
    expect(as[3].notes).toBe('توجد بعض الصخور الحجرية على العقار');
  });
  it('reads district names and map coordinates', () => {
    expect(districtFromText('أرض سكنية حي أحد بالرياض')).toBe('أحد');
    expect(districtFromText('تفاصيل العقار: دور ارضي')).toBeNull();
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/24.6123,46.7012/@24.6123,46.7012,17z')).toEqual({ lat: 24.6123, lng: 46.7012 });
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/X/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d24.75!4d46.62')).toEqual({ lat: 24.75, lng: 46.62 });
    expect(coordsFromMapsUrl('https://maps.google.com/?q=24.5,46.6')).toEqual({ lat: 24.5, lng: 46.6 });
    expect(coordsFromMapsUrl('https://maps.app.goo.gl/96rDXdRpeHEhFk5A7')).toBeNull();
    expect(coordsFromMapsUrl('https://www.google.com/maps/@46.6,24.5,17z')).toBeNull(); // swapped → not in KSA
  });

});

describe('infath list pagination', () => {
  it('reads the last page number from the real pagination (upcoming tab, 4 pages)', () => {
    const page = readFileSync(join(__dirname, 'fixtures', 'infath-upcoming-pagination.html'), 'utf8');
    expect(lastPageNumber(page)).toBe(4);
    expect(lastPageNumber('<html>no pagination</html>')).toBe(1);
  });
});

describe('infath map links', () => {
  it('does not throw on a malformed link', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/%E0%A4%A/@24.6,46.7,17z')).toEqual({ lat: 24.6, lng: 46.7 });
  });
});
