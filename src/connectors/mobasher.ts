/**
 * مباشر للمزادات — https://mobasher.sa
 * React SPA backed by a public JSON "discovery" API (found by inspecting network calls):
 *   GET https://discovery-api.prod.mobasher.sa/api/v1/discovery/auctions?pageSize=&status=&cursor=&includeTotal=true
 * Cursor pagination. Times are UTC ISO strings.
 */
import { getJson } from '@/lib/http';
import { mapCategory, mapPropertyType, mapUsage, parseArea, parseMoney, cleanText, uniq, type Status } from '@/lib/normalize';
import { parseIso } from '@/lib/time';
import type { Connector, RawAsset, RawAuction, RefreshMode } from './types';

const API = 'https://discovery-api.prod.mobasher.sa/api/v1/discovery/auctions';
const PRODUCTS_API = 'https://discovery-api.prod.mobasher.sa/api/v1/discovery/auction-products';
const PRODUCT_STATUSES = ',SOLD,PASS,POSTPONE,PAUSED,RUNNING,PENDING,CREATED,POSTPONE_WITH_HBID,LIVE_NOW,SOLD_BUY_NOW,OFFER,PAYMENT_PENDING,WAITING_INFATH_RESPONSE';
const STATUS: Record<string, Status> = { LIVE: 'live', SCHEDULED: 'upcoming', CLOSED: 'ended', ENDED: 'ended', CANCELLED: 'ended' };

export function parseMobasherItem(i: any): RawAuction {
  const id = String(i.sourceEntityId ?? i.documentId);
  const path = i.auctionType === 'HYBRID' ? 'hybrid-auction' : 't-container-details';
  const cities: string[] = uniq<string>(i.cityNamesAr?.length ? i.cityNamesAr : i.cityNames ?? []);
  return {
    externalId: id,
    url: `https://mobasher.sa/auctions/${path}/${id}`,
    title: cleanText(i.title) ?? `مزاد ${id}`,
    category: i.auctionCategory === 'REAL_ESTATES' ? 'real_estate' : i.auctionCategory === 'VEHICLES' ? 'vehicle' : mapCategory(i.title),
    status: STATUS[i.status] ?? null,
    startAt: parseIso(i.startTimeUtc),
    endAt: parseIso(i.scheduledEndTimeUtc ?? i.effectiveEndTimeUtc),
    cities,
    city: cities[0] ?? null,
    regions: uniq<string>(i.regionNamesAr ?? []),
    region: i.regionNamesAr?.[0] ?? null,
    districts: uniq<string>(i.neighborhoodNamesAr ?? []),
    district: i.neighborhoodNamesAr?.[0] ?? null,
    assetCount: typeof i.productCount === 'number' ? i.productCount : null,
    currentPrice: parseMoney(i.currentLeadingBid),
    images: uniq<string>([i.coverImageUrl]),
    organizer: cleanText(i.sellerNameAr ?? i.sellerName),
    raw: {
      documentId: i.documentId, auctionType: i.auctionType, status: i.status, auctionCategory: i.auctionCategory,
      effectiveEndTimeUtc: i.effectiveEndTimeUtc, nextEffectiveEndTimeUtc: i.nextEffectiveEndTimeUtc, updatedAtUtc: i.updatedAtUtc, isInternational: i.isInternational,
    },
  };
}

/** One product (= asset, e.g. a land plot) of a Mobasher auction. */
export function parseMobasherProduct(p: any, auctionUrl: string): RawAsset {
  const re = p.realEstateDetails ?? {};
  const title = cleanText(p.title);
  return {
    externalId: String(p.sourceEntityId ?? p.documentId),
    title,
    url: auctionUrl,
    city: cleanText(p.cityNameAr ?? p.cityName),
    region: cleanText(p.regionNameAr ?? p.regionName),
    district: cleanText(p.neighborhoodNameAr ?? p.neighborhoodName),
    latitude: typeof p.geoLocation?.lat === 'number' ? p.geoLocation.lat : null,
    longitude: typeof p.geoLocation?.lon === 'number' ? p.geoLocation.lon : null,
    startPrice: parseMoney(p.openingPrice),
    currentPrice: parseMoney(p.currentLeadingBid),
    deposit: parseMoney(p.insuranceAmount),
    images: uniq<string>([...(p.imageUrls ?? []), p.coverImageUrl]),
    propertyType: p.category === 'REAL_ESTATES' || re.propertyType ? mapPropertyType(re.propertyType, re.propertyTypeAr, title) : null,
    usage: mapUsage(re.usageType, re.usageTypeAr, title),
    areaSqm: parseArea(re.spaceSqm ?? re.listedAreaSqm),
    status: p.productStatus ?? null,
  };
}

/** Attach products (assets) to real-estate auctions — one batched request per 25 auctions. */
async function attachProducts(auctions: RawAuction[], log: any) {
  const targets = auctions.filter((a) => a.category === 'real_estate' && a.status !== 'ended');
  const byId = new Map(targets.map((a) => [a.externalId, a]));
  for (let i = 0; i < targets.length; i += 25) {
    const ids = targets.slice(i, i + 25).map((a) => a.externalId);
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const qs = new URLSearchParams({ productStatus: PRODUCT_STATUSES, auctionContainerIds: ids.join(','), pageSize: '100', includeTotal: 'true', includeImageUrls: 'true' });
      if (cursor) qs.set('cursor', cursor);
      const d: any = await getJson(`${PRODUCTS_API}?${qs}`);
      for (const p of d.items ?? []) {
        const a = byId.get(String(p.auctionContainerId));
        if (a) (a.assets ??= []).push(parseMobasherProduct(p, a.url));
      }
      cursor = d.nextCursor ?? null;
      if (!cursor) break;
    }
  }
  log.debug({ auctions: targets.length, assets: targets.reduce((n, a) => n + (a.assets?.length ?? 0), 0) }, 'mobasher products');
}

const MODE_STATUSES: Record<RefreshMode, string[]> = {
  discovery: ['LIVE', 'SCHEDULED'], manual: ['LIVE', 'SCHEDULED'], live: ['LIVE'], closing: ['LIVE'], upcoming: ['SCHEDULED'], ended: ['CLOSED'],
};

export const mobasher: Connector = {
  id: 'mobasher',
  name: 'مباشر',
  baseUrl: 'https://mobasher.sa',
  method: 'api',
  modes: ['discovery', 'manual', 'live', 'closing', 'upcoming', 'ended'],
  async fetchAuctions({ mode, log }) {
    const out: RawAuction[] = [];
    for (const status of MODE_STATUSES[mode]) {
      let cursor: string | null = null;
      const maxPages = status === 'CLOSED' ? 1 : 15; // ended: only the most recent page
      for (let page = 0; page < maxPages; page++) {
        const qs = new URLSearchParams({ pageSize: '100', includeTotal: 'true', status });
        if (cursor) qs.set('cursor', cursor);
        const d: any = await getJson(`${API}?${qs}`);
        const items: any[] = d.items ?? [];
        out.push(...items.filter((i) => i.listingType === 'AUCTION' || !i.listingType).map(parseMobasherItem));
        log.debug({ status, page, n: items.length, total: d.totalItems }, 'mobasher page');
        cursor = d.nextCursor ?? null;
        if (!cursor || items.length === 0) break;
      }
    }
    await attachProducts(out, log);
    return out;
  },
};
