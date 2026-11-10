import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devalue, nodeWith, parseSoumAuction, parseSoumAsset } from '@/connectors/soum';
import { toListingData } from '@/lib/ingest';

// Real data captured from soum.tech on 2026-11-10 (contact fields removed)
const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', f), 'utf8'));

describe('devalue decoder', () => {
  it('resolves index references, dates and undefined', () => {
    const flat = [{ a: 1, list: 2, when: 4, none: -1 }, 'x', [3, 1], { b: 1 }, ['Date', '2026-01-01T00:00:00.000Z']];
    expect(devalue(flat)).toEqual({ a: 'x', list: [{ b: 'x' }, 'x'], when: '2026-01-01T00:00:00.000Z', none: undefined });
  });
  it('finds the page node by key', () => {
    const json = { type: 'data', nodes: [null, { type: 'data', data: [{ user: 1 }, null] }, { type: 'data', data: [{ auctions: 1, meta: 2 }, [], { total: 3 }, 669] }] };
    expect(nodeWith(json, 'auctions')).toEqual({ auctions: [], meta: { total: 669 } });
  });
});

describe('soum auctions', () => {
  const list = fx('soum-list.json').auctions;
  const byId = (id: number) => parseSoumAuction(list.find((a: any) => a.id === id));
  it('maps a live Riyadh auction', () => {
    const a = byId(1230);
    expect(a).toMatchObject({ title: 'رفاد', status: 'live', city: 'الرياض', district: 'المصانع', organizer: 'شركة ساعد العقارية', url: 'https://soum.tech/auctions/1230/assets', category: 'real_estate' });
    expect(a.startAt?.toISOString()).toBe('2026-11-10T14:00:00.000Z');
    expect(a.endAt?.toISOString()).toBe('2026-11-12T15:30:00.000Z');
    expect(toListingData(a).geo.scope).toBe('riyadh_city');
    expect(a.images[0]).toMatch(/^https:\/\/.*oraclecloud\.com\/soom-prod-bucket-public\/auction_group_banners\//);
  });
  it('maps statuses', () => {
    expect(byId(1236).status).toBe('upcoming');
    expect(byId(1224).status).toBe('ended');
  });
  it('places Al-Kharj in Riyadh region, not Riyadh city', () => {
    expect(toListingData(byId(1223)).geo.scope).toBe('riyadh_region');
  });
});

describe('soum assets', () => {
  const d = fx('soum-assets-1233.json').auction;
  const as = d.content.map((x: any) => parseSoumAsset(x, 'https://soum.tech/auctions/1233/assets'));
  it('reads land type, area and deposit', () => {
    expect(as[0]).toMatchObject({ propertyType: 'land', areaSqm: 3049.86, deposit: 500000, city: 'المدينة المنورة' });
  });
  it('turns a per-square-metre price into the total', () => {
    expect(as[0].startPrice).toBe(Math.round(5400 * 3049.86));
  });
});
