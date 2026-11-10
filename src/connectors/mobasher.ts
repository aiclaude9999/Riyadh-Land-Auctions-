/**
 * مباشر للمزادات — https://mobasher.sa
 * React SPA backed by a public JSON "discovery" API (found by inspecting network calls):
 *   GET https://discovery-api.prod.mobasher.sa/api/v1/discovery/auctions?pageSize=&status=&cursor=&includeTotal=true
 * Cursor pagination. Times are UTC ISO strings.
 */
import { getJson } from '@/lib/http';
import { mapCategory, parseMoney, cleanText, uniq, type Status } from '@/lib/normalize';
import { parseIso } from '@/lib/time';
import type { Connector, RawAuction, RefreshMode } from './types';

const API = 'https://discovery-api.prod.mobasher.sa/api/v1/discovery/auctions';
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
    return out;
  },
};
