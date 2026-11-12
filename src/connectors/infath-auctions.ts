/**
 * إنفاذ للمزادات — https://auctions.infath.gov.sa  (Infath's own bidding platform, Angular)
 * Public JSON API (no login; the site sends Accept-Language + x-platform-id: web):
 *   GET {API}/auction-items?pageIndex=&pageSize=&categoryId=&statusIds=2,3   → one row per item (asset)
 *        statusId 2 = upcoming (Scheduled), 3 = ongoing. Real estate categoryId 1111…1111.
 *   GET {API}/auction-items/{id}   → customFieldSections: per deed "Property Information" (type, usage,
 *        region, city, district, area, block, deed) + "Property Boundaries".
 * Items of one auction share `referenceId` (e.g. A-47105-2611-0060) → grouped into one auction here.
 * Times have no zone and are UTC (detail `endsAt` = endTime + "+00:00").
 * Bidding needs Nafath; we only read public listings. Geo-blocked outside KSA → `saudiOnly` (laptop).
 */
import { getJson } from '@/lib/http';
import { cleanText, mapPropertyType, mapUsage, parseArea, parseMoney, uniq, type Status } from '@/lib/normalize';
import { inRiyadhCityBox, isRiyadhCity, isRiyadhRegionName, isRiyadhRegionTown } from '@/lib/geo';
import { plotFeatures } from '@/lib/plot';
import type { Connector, RawAsset, RawAuction, RefreshMode } from './types';

const API = 'https://api.infath.gov.sa/auctions-platform/v1/auctions/api/v1';
const SITE = 'https://auctions.infath.gov.sa';
const REAL_ESTATE = '11111111-1111-1111-1111-111111111111';
const HEADERS = { 'Accept-Language': 'ar', 'x-platform-id': 'web' };
const PAGE_SIZE = 20; // same as the website
const MAX_PAGES = 60;
const STATUS: Record<number, Status> = { 2: 'upcoming', 3: 'live' };
/** statusId 2/3 are confirmed by the site; anything else is read from statusName (Ended, Closed, Sold, Awarded…). */
export function itemStatus(x: { statusId?: number | null; statusName?: string | null }): Status | null {
  if (x.statusId != null && STATUS[x.statusId]) return STATUS[x.statusId];
  const n = (x.statusName ?? '').toLowerCase();
  if (/schedul|upcoming|pending/.test(n)) return 'upcoming';
  if (/active|live|ongoing|running/.test(n)) return 'live';
  if (/end|clos|sold|award|complet|finish|cancel|expir/.test(n)) return 'ended';
  return null;
}

export interface PlatformItem {
  id: string; auctionId?: string; statusId?: number; itemNameAr?: string | null; itemName?: string | null;
  auctionTitleAr?: string | null; auctionTitle?: string | null; imageUrl?: string | null;
  startTime?: string | null; endTime?: string | null; latitude?: number | null; longitude?: number | null;
  currentBid?: number | null; startingPrice?: number | null; isStartingPriceDetermined?: boolean; soldPrice?: number | null;
  depositAmount?: number | null; cityNameAr?: string | null; regionNameAr?: string | null; referenceId?: string | null;
  bidCount?: number | null; participantsCount?: number | null; statusName?: string | null;
}

/** "2026-12-03T05:00:00" (UTC without zone) → Date */
export function utc(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
  return isNaN(+d) ? null : d;
}

const STOP = new Set(['الرياض', 'بالرياض', 'بمساحة', 'مساحة', 'بمدينة', 'مدينة', 'في', 'و', 'بالدمام', 'ببريدة', 'بجدة']);
/** "فيلا سكنية بحي الشفا" → "الشفا"; "أرض سكنية بحي عريض الرياض" → "عريض"; "عمارة - حي الصفا" → "الصفا" */
export function districtFromName(name?: string | null): string | null {
  const m = name?.match(/(?:^|[\s\-،,])(?:ب|في\s+)?حي\s+(.+)$/);
  if (!m) return null;
  const words: string[] = [];
  for (const w of m[1].split(/\s+/)) {
    const t = w.replace(/[،,.\-()]+$/g, '');
    if (!t || STOP.has(t) || /^\d/.test(t) || /^ب?مساحة/.test(t)) break;
    words.push(t);
    if (w !== t || words.length === 3) break; // punctuation ends the name
  }
  const d = words.join(' ').trim();
  return d && d !== 'خارج' && !d.startsWith('خارج حدود') ? d : null;
}

/** "… بمساحة 226.92 م٢" → 226.92 */
export function areaFromName(name?: string | null): number | null {
  const m = name?.match(/مساحة\s*([\d٠-٩.,]+)\s*(?:م|متر)/);
  return m ? parseArea(m[1]) : null;
}

/** Riyadh city / region items get the (extra) detail request; others keep the list data only. */
export function isRiyadhItem(x: PlatformItem): boolean {
  return isRiyadhRegionName(x.regionNameAr) || isRiyadhCity(x.cityNameAr) || isRiyadhRegionTown(x.cityNameAr)
    || (!x.regionNameAr && !x.cityNameAr && inRiyadhCityBox(x.latitude, x.longitude))
    || /الرياض/.test(x.itemNameAr ?? '');
}

export interface ItemDetail { plots: Record<string, string | null>[]; description: string | null; boundaries: Record<string, string | null>[] }

/** Per-deed "Property Information" sections of an item's detail answer. */
export function parseDetail(d: any): ItemDetail {
  const plots: Record<string, string | null>[] = [];
  const boundaries: Record<string, string | null>[] = [];
  for (const s of d?.customFieldSections ?? []) {
    if (s?.sectionName === 'Property Boundaries') {
      const b: Record<string, string | null> = {};
      for (const x of s.fields ?? []) if (/LimitName$/.test(x.fieldName)) b[x.fieldName] = cleanText(x.value == null ? null : String(x.value));
      boundaries.push(b);
      continue;
    }
    if (s?.sectionName !== 'Property Information') continue;
    const f: Record<string, string | null> = {};
    for (const x of s.fields ?? []) f[x.fieldName] = cleanText(x.value == null ? null : String(x.value));
    plots.push(f);
  }
  return { plots, description: cleanText(d?.description), boundaries };
}

const itemUrl = (id: string) => `${SITE}/auctions/${id}`;

/** "صك 8332…: نوع فيلا سكني · بلوك 17 · 500 م²" per deed (only fields the source fills) */
export function plotNotes(plots: Record<string, string | null>[]): string | null {
  const lines = plots.map((p) => [
    p.DeedNumber && `صك ${p.DeedNumber}`,
    p.PropertyType && `النوع: ${p.PropertyType}`,
    p.PlanNumber && `مخطط ${p.PlanNumber}`,
    p.BlockNumber && `بلوك ${p.BlockNumber}`,
    p.Area && `${p.Area} م²`,
  ].filter(Boolean).join(' · ')).filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

export function toAsset(x: PlatformItem, detail?: ItemDetail): RawAsset {
  const name = cleanText(x.itemNameAr ?? x.itemName) ?? `أصل ${x.id}`;
  const plots = detail?.plots ?? [];
  const first = plots[0] ?? {};
  const areas = plots.map((p) => parseArea(p.Area)).filter((a): a is number => a != null);
  const area = areas.length ? areas.reduce((s, a) => s + a, 0) : areaFromName(name);
  const district = first.District?.replace(/^حي\s+/, '') ?? districtFromName(name);
  const price = x.isStartingPriceDetermined === false ? null : parseMoney(x.startingPrice);
  const title = plots.length > 1 ? `${name} (${plots.length} صكوك)` : name;
  return {
    externalId: x.id,
    title,
    url: itemUrl(x.id),
    region: cleanText(x.regionNameAr) ?? first.Region ?? null,
    city: cleanText(x.cityNameAr) ?? first.City ?? null,
    district,
    latitude: typeof x.latitude === 'number' ? x.latitude : null,
    longitude: typeof x.longitude === 'number' ? x.longitude : null,
    startPrice: price,
    currentPrice: parseMoney(x.currentBid),
    deposit: parseMoney(x.depositAmount),
    images: x.imageUrl ? [x.imageUrl] : [],
    propertyType: mapPropertyType(first.PropertyType, name),
    usage: mapUsage(first.TypeOfPropertyDeed, first.PropertyType, name),
    areaSqm: area,
    status: itemStatus(x),
    soldPrice: parseMoney(x.soldPrice),
    deedNumber: first.DeedNumber ?? null,
    description: detail?.description ?? null,
    notes: plotNotes(plots),
    ...(() => { const f = detail?.boundaries[0] ? plotFeatures(detail.boundaries[0]) : null; return f ? { streetSides: f.streetSides, streetWidth: f.streetWidth, corner: f.corner } : {}; })(),
  };
}

/** Group list rows (plus optional details) into auctions by their shared reference id. */
export function groupItems(items: PlatformItem[], details: Map<string, ItemDetail> = new Map()): RawAuction[] {
  const groups = new Map<string, PlatformItem[]>();
  for (const x of items) {
    const key = x.referenceId || x.auctionId || x.id;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  const out: RawAuction[] = [];
  for (const [ref, rows] of groups) {
    const assets = rows.map((x) => toAsset(x, details.get(x.id)));
    const starts = rows.map((x) => utc(x.startTime)).filter((d): d is Date => !!d);
    const ends = rows.map((x) => utc(x.endTime)).filter((d): d is Date => !!d);
    const statuses = assets.map((a) => a.status as Status | null);
    const status: Status | null = statuses.includes('live') ? 'live' : statuses.includes('upcoming') ? 'upcoming' : statuses[0] ?? null;
    const prices = assets.map((a) => a.startPrice).filter((p): p is number => p != null);
    const title = cleanText(rows[0].auctionTitleAr ?? rows[0].auctionTitle) ?? cleanText(rows[0].itemNameAr) ?? `مزاد إنفاذ ${ref}`;
    out.push({
      externalId: ref,
      url: itemUrl(rows[0].id),
      title,
      category: 'real_estate',
      status,
      startAt: starts.length ? new Date(Math.min(...starts.map(Number))) : null,
      endAt: ends.length ? new Date(Math.max(...ends.map(Number))) : null,
      region: assets.find((a) => a.region)?.region ?? null,
      regions: uniq(assets.map((a) => a.region)),
      city: assets.find((a) => a.city)?.city ?? null,
      cities: uniq(assets.map((a) => a.city)),
      districts: uniq(assets.map((a) => a.district)),
      latitude: assets[0].latitude ?? null,
      longitude: assets[0].longitude ?? null,
      assetCount: rows.length,
      startPrice: prices.length ? Math.min(...prices) : null,
      deposit: assets.map((a) => a.deposit).filter((p): p is number => p != null).sort((a, b) => a - b)[0] ?? null,
      images: uniq(assets.flatMap((a) => a.images ?? [])).slice(0, 5),
      organizer: 'إنفاذ',
      crossRefs: rows[0].referenceId ? [`infath-ref:${rows[0].referenceId}`] : [],
      assets,
      raw: { referenceId: rows[0].referenceId, items: rows.length },
    });
  }
  return out;
}

// ended ids are not documented on the site: ask for 4–6 once a day and trust statusName for the label
const MODE_STATUSES: Record<RefreshMode, string> = {
  discovery: '2,3', manual: '2,3', live: '3', closing: '3', upcoming: '2', ended: '4,5,6',
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const infathAuctions: Connector = {
  id: 'infath-auctions',
  name: 'إنفاذ للمزادات',
  baseUrl: SITE,
  method: 'api',
  saudiOnly: true,
  modes: ['discovery', 'manual', 'live', 'closing', 'upcoming', 'ended'],
  async fetchAuctions({ mode, log }) {
    const items: PlatformItem[] = [];
    const maxPages = mode === 'ended' ? 5 : MAX_PAGES; // ended: recent results only
    for (let page = 1; page <= maxPages; page++) {
      const d: any = await getJson(`${API}/auction-items?pageIndex=${page}&pageSize=${PAGE_SIZE}&categoryId=${REAL_ESTATE}&statusIds=${MODE_STATUSES[mode]}`, { headers: HEADERS, timeoutMs: 25_000, retries: 1 });
      const rows: PlatformItem[] = d?.data?.items ?? [];
      items.push(...rows);
      log.debug({ page, n: rows.length, total: d?.data?.totalCount }, 'infath-auctions page');
      if (!d?.data?.hasNext || !rows.length) break;
      await pause(300);
    }
    // details (area, usage, district, deeds) only for Riyadh items, one at a time
    const details = new Map<string, ItemDetail>();
    const deadline = Date.now() + 6 * 60_000;
    let failures = 0;
    for (const x of mode === 'ended' ? [] : items.filter(isRiyadhItem)) {
      if (Date.now() > deadline || failures >= 5) {
        log.warn({ done: details.size, failures }, 'infath-auctions details stopped early (time budget / repeated failures)');
        break;
      }
      try {
        const d: any = await getJson(`${API}/auction-items/${encodeURIComponent(x.id)}`, { headers: HEADERS, timeoutMs: 20_000, retries: 1 });
        details.set(x.id, parseDetail(d?.data));
        failures = 0;
      } catch (e: any) {
        failures++;
        log.warn({ item: x.id, err: e.message }, 'infath-auctions detail failed — list data kept');
      }
      await pause(300);
    }
    log.info({ items: items.length, riyadhDetails: details.size }, 'infath-auctions fetched');
    return groupItems(items, details);
  },
};
