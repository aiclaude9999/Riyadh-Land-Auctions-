/**
 * سومتك — https://soum.tech  (SvelteKit; national auction platform, also runs some Infath auctions)
 *   GET /auctions/__data.json?category=1&page=N        → auction groups (8 per page, newest first)
 *   GET /auctions/{id}/assets/__data.json              → the group's assets (plots, villas, …)
 * Data is SvelteKit's "devalue" format (a flat array with index references), decoded below.
 * Dates are naive UTC ("YYYY-MM-DD HH:MM:SS"; "13:00" in the data is shown as 04:00 PM on the site).
 * Prices can be per square metre (bidWithMeterPrice): the total is then price × area.
 * Contact numbers and owner details in the payload are NOT stored.
 */
import { getJson } from '@/lib/http';
import { cleanText, mapCategory, mapPropertyType, mapUsage, parseArea, parseMoney, uniq, type Status } from '@/lib/normalize';
import { parseUtcNaive } from '@/lib/time';
import type { Connector, RawAsset, RawAuction, RefreshMode } from './types';

const BASE = 'https://soum.tech';
const FILES = 'https://axs1msfgyhit.compat.objectstorage.me-jeddah-1.oraclecloud.com/soom-prod-bucket-public';
const STATUS: Record<string, Status> = { current: 'live', coming: 'upcoming', ended: 'ended' };

/** Decode SvelteKit/devalue flat data: values are arrays of nodes whose numbers point at other nodes. */
export function devalue(arr: unknown[]): any {
  const memo = new Map<number, unknown>();
  const r = (i: unknown): unknown => {
    if (typeof i !== 'number') return i;
    if (i < 0) return i === -3 ? NaN : i === -4 ? Infinity : i === -5 ? -Infinity : i === -6 ? -0 : undefined;
    if (memo.has(i)) return memo.get(i);
    const v = arr[i];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        if (typeof v[0] === 'string' && ['Date', 'BigInt', 'RegExp', 'URL'].includes(v[0])) return v[1];
        const out: unknown[] = [];
        memo.set(i, out);
        v.forEach((x) => out.push(r(x)));
        return out;
      }
      const out: Record<string, unknown> = {};
      memo.set(i, out);
      for (const [k, x] of Object.entries(v)) out[k] = r(x);
      return out;
    }
    return v;
  };
  return r(0);
}

/** Pick the page node whose root object has `key` from a SvelteKit __data.json response. */
export function nodeWith(json: any, key: string): any {
  for (const n of json?.nodes ?? []) {
    const d = n?.data;
    if (Array.isArray(d) && d[0] && typeof d[0] === 'object' && key in d[0]) return devalue(d);
  }
  return null;
}

const file = (p?: string | null) => (p ? (p.startsWith('http') ? p : FILES + p) : null);
const total = (price: unknown, perMeter: unknown, area: unknown) => {
  const p = parseMoney(price), a = parseArea(area);
  if (p == null) return null;
  return perMeter ? (a != null ? Math.round(p * a) : null) : p;
};

export function parseSoumAuction(x: any): RawAuction {
  const id = String(x.id);
  const title = cleanText(x.name) ?? `مزاد ${id}`;
  const city = cleanText(x.cityName), district = cleanText(x.districtName)?.replace(/^حي\s+/, '') ?? null, region = cleanText(x.regionName);
  const single = (x.noOfAuctions ?? 0) <= 1;
  return {
    externalId: id,
    url: `${BASE}/auctions/${id}/assets`,
    title,
    category: mapCategory(x.categoryTitle, x.productTypeEnum, title),
    status: STATUS[x.groupStatus] ?? null,
    startAt: parseUtcNaive(x.startDate),
    endAt: parseUtcNaive(x.actualEndDate ?? x.endDate),
    city, cities: city ? [city] : [], district, districts: district ? [district] : [], region, regions: region ? [region] : [],
    assetCount: typeof x.noOfAuctions === 'number' ? x.noOfAuctions : null,
    // a group-level price is only meaningful for single-asset auctions
    startPrice: single ? total(x.openingPrice, x.bidWithMeterPrice, x.area) : null,
    currentPrice: single && x.groupStatus !== 'coming' && x.highestPrice !== x.openingPrice ? total(x.highestPrice, x.bidWithMeterPrice, x.area) : null,
    images: uniq<string>([file(x.banner)]),
    organizer: cleanText(x.organizationName),
    crossRefs: [],
    raw: { id: x.id, groupStatus: x.groupStatus, productTypeEnum: x.productTypeEnum, isInfath: x.isInfath, isHybrid: x.isHybrid, target: x.targetName, area: x.area },
  };
}

export function parseSoumAsset(x: any, auctionUrl: string): RawAsset {
  const name = cleanText(x.name ?? x.productName);
  const typeText = [x.productType, name].filter(Boolean).join(' ');
  return {
    externalId: String(x.id),
    title: name,
    url: auctionUrl,
    city: cleanText(x.cityName),
    district: cleanText(x.districtName)?.replace(/^حي\s+/, '') ?? null,
    latitude: typeof x.latitude === 'number' ? x.latitude : null,
    longitude: typeof x.longitude === 'number' ? x.longitude : null,
    areaSqm: parseArea(x.area),
    startPrice: total(x.openingPrice, x.bidWithMeterPrice, x.area),
    currentPrice: x.highestPrice !== x.openingPrice ? total(x.highestPrice, x.bidWithMeterPrice, x.area) : null,
    deposit: x.insuranceType === 'value' || !x.insuranceType ? parseMoney(x.insuranceAmount) : null,
    propertyType: mapPropertyType(x.productType, name),
    usage: mapUsage(name, x.productType),
    images: uniq<string>([file(x.banner)]),
    status: cleanText(x.status),
  };
}

export const soum: Connector = {
  id: 'soum',
  name: 'سومتك',
  baseUrl: BASE,
  method: 'api',
  modes: ['discovery', 'manual', 'ended'],
  async fetchAuctions({ mode, log }: { mode: RefreshMode; log: any }) {
    const byId = new Map<string, RawAuction>();
    const maxPages = mode === 'ended' ? 1 : 8;
    for (let page = 1; page <= maxPages; page++) {
      const n = nodeWith(await getJson(`${BASE}/auctions/__data.json?category=1&page=${page}`), 'auctions');
      const list: any[] = n?.auctions ?? [];
      list.forEach((x) => byId.set(String(x.id), parseSoumAuction(x)));
      log.debug({ page, n: list.length, last: n?.meta?.lastPage }, 'soum page');
      // newest first: stop once a whole page is finished auctions, or at the last page
      if (!list.length || page >= (n?.meta?.lastPage ?? 1) || (page > 1 && list.every((x) => x.groupStatus === 'ended'))) break;
    }
    for (const a of byId.values()) {
      if (a.status === 'ended') continue;
      try {
        const d = nodeWith(await getJson(`${BASE}/auctions/${a.externalId}/assets/__data.json`), 'auction');
        a.assets = (d?.auction?.content ?? []).map((x: any) => parseSoumAsset(x, a.url));
        if (!a.endAt) a.endAt = parseUtcNaive(d?.auction?.content?.find((x: any) => x.endDate)?.endDate);
      } catch (e: any) {
        log.warn({ auction: a.externalId, err: e.message }, 'soum assets failed — auction kept without assets');
      }
    }
    return [...byId.values()];
  },
};
