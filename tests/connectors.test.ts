import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMobasherItem } from '@/connectors/mobasher';
import { parseSaudiaItem } from '@/connectors/saudia-auctions';
import { parseMazadatItem } from '@/connectors/mazadat';
import { parseTarsyahItem } from '@/connectors/tarsyah';
import { parseQemahItem } from '@/connectors/qemah';
import { toListingData } from '@/lib/ingest';

// Fixtures are trimmed REAL responses captured from each platform on 2026-11-10.
const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', f), 'utf8'));

describe('mobasher', () => {
  const items = fx('mobasher.json').items.map(parseMobasherItem);
  it('maps fields from the discovery API', () => {
    const a = items[0];
    expect(a.externalId).toBe('5494');
    expect(a.url).toBe('https://mobasher.sa/auctions/t-container-details/5494');
    expect(a.title).toBe('مزاد مشارق');
    expect(a.category).toBe('real_estate');
    expect(a.status).toBe('live');
    expect(a.cities).toEqual(['الخبر', 'الهفوف']);
    expect(a.organizer).toBe('سماية العقارية');
    expect(a.startAt?.toISOString()).toBe('2026-11-08T09:00:00.000Z');
    expect(a.endAt?.toISOString()).toBe('2026-11-10T14:40:00.000Z');
    expect(a.assetCount).toBe(10);
    expect(a.currentPrice).toBeNull(); // 0 means "no bid" → not available
  });
  it('marks multi-city auctions', () => {
    expect(toListingData(items[0]).geo.isMultiLocation).toBe(true);
    expect(toListingData(items[0]).geo.scope).toBe('other');
  });
});

describe('saudia-auctions', () => {
  const items = fx('saudia-auctions.json').data.map((x: any) => parseSaudiaItem(x));
  it('parses naive UTC dates, location and organiser', () => {
    const a = items[0];
    expect(a.url).toBe('https://www.auctions.com.sa/auction_live/33229');
    expect(a.startAt?.toISOString()).toBe('2026-11-09T07:00:00.000Z');
    expect(a.status).toBe('live');
    expect(a.city).toBe('Riyadh');
    expect(a.districts).toContain('الملك سلمان');
    expect(a.organizer).toBe('شركة كانف العقارية');
    expect(a.images[0]).toMatch(/^https:\/\/www\.auctions\.com\.sa\/web\/content\//);
    expect(toListingData(a).geo.scope).toBe('riyadh_city');
  });
});

describe('mazadat', () => {
  const items = fx('mazadat.json').content.map(parseMazadatItem);
  it('maps each lot with prices and an asset', () => {
    const a = items[0];
    expect(a.category).toBe('vehicle');
    expect(['live', 'upcoming']).toContain(a.status);
    expect(a.url).toMatch(/^https:\/\/mazadat\.sa\/v2\/auctions\/\d+\/details\//);
    expect(a.assets).toHaveLength(1);
    expect(a.images[0]).toMatch(/^https:\/\/api\.mazadat\.sa\/api\/v2\/file\/\d+$/);
    expect(a.organizer).toBeNull(); // not exposed by the API → left empty
  });
});

describe('tarsyah', () => {
  const d = fx('tarsyah.json');
  const items = d.content.map((x: any) => parseTarsyahItem(x, d.images_prefix));
  it('maps status and derives location only from the listing text', () => {
    const horses = items.find((x: any) => x.externalId === '134')!;
    expect(horses.status).toBe('live');
    expect(horses.category).toBe('collectible');
    expect(horses.cities).toEqual([]);
    const riyadh = items.find((x: any) => x.title.includes('الملقا'));
    if (riyadh) expect(toListingData(riyadh).geo.scope).toBe('riyadh_city');
    const scrap = items.find((x: any) => x.externalId === '133')!;
    expect(scrap.category).toBe('scrap');
    expect(scrap.cities).toContain('جدة');
  });
});

describe('qemah', () => {
  it('reads only auction-level fields; start time is Riyadh local', () => {
    const a = parseQemahItem(fx('qemah-upcoming.json').data[0], 'upcoming');
    expect(a.title).toBe('مزاد لوح 71');
    expect(a.startAt?.toISOString()).toBe('2026-11-11T16:20:00.000Z'); // 19:20 Riyadh
    expect(a.endAt).toBeNull();
    expect(a.status).toBe('upcoming');
    expect(JSON.stringify(a.raw)).not.toMatch(/identity|license|uploads/);
  });
});
