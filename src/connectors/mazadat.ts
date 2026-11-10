/**
 * مزادات — https://mazadat.sa  (Angular SPA; config at /assets/config/env.js → https://api.mazadat.sa)
 *   POST https://api.mazadat.sa/api/v2/search?page=&size=&sort=endDate,asc   body: {"$and":[{"status":{"$in":[...]}}]}
 * Each search hit is a single lot (mostly vehicles) with its own start/end, start price and highest bid.
 * Times are epoch milliseconds. Images: https://api.mazadat.sa/api/v2/file/{mainImageId}
 */
import { getJson } from '@/lib/http';
import { mapCategory, parseMoney, cleanText, type Status } from '@/lib/normalize';
import { fromEpochMs } from '@/lib/time';
import type { Connector, RawAuction, RefreshMode } from './types';

const API = 'https://api.mazadat.sa/api/v2';
const STATUS: Record<string, Status> = { ACTIVE: 'live', ANNOUNCED: 'upcoming', SOLD: 'ended', UNSOLD: 'ended', CLOSED: 'ended', CANCELLED: 'ended' };

const slug = (s: string) => s.trim().replace(/\s+/g, '-');

export function parseMazadatItem(x: any): RawAuction {
  const title = cleanText(x.nameAr) ?? cleanText(x.nameEn) ?? `مزاد ${x.id}`;
  const img = x.mainImageId ? `${API}/file/${x.mainImageId}` : null;
  const isVehicle = !!(x.makerAr || x.makerEn || x.modelYear);
  const lat = typeof x.latitude === 'number' ? x.latitude : null;
  const lng = typeof x.longitude === 'number' ? x.longitude : null;
  const url = `https://mazadat.sa/v2/auctions/${x.id}/details/${encodeURIComponent(slug(title))}`;
  return {
    externalId: String(x.id),
    url,
    title,
    category: isVehicle ? 'vehicle' : mapCategory(title),
    status: STATUS[x.status] ?? null,
    startAt: fromEpochMs(x.startDate),
    endAt: fromEpochMs(x.endDate),
    city: cleanText(x.cityNameAr ?? x.cityNameEn),
    cities: [cleanText(x.cityNameAr ?? x.cityNameEn)].filter(Boolean) as string[],
    latitude: lat,
    longitude: lng,
    assetCount: 1,
    startPrice: parseMoney(x.initialPrice),
    currentPrice: parseMoney(x.highestBidAmount),
    images: img ? [img] : [],
    organizer: null, // only a numeric clientId is exposed
    assets: [{
      externalId: String(x.id), title, url, city: cleanText(x.cityNameAr), latitude: lat, longitude: lng,
      startPrice: parseMoney(x.initialPrice), currentPrice: parseMoney(x.highestBidAmount), images: img ? [img] : [],
    }],
    raw: { id: x.id, status: x.status, clientId: x.clientId, modelYear: x.modelYear, biddersCount: x.biddersCount, scope: x.scope, announcementDate: x.announcementDate },
  };
}

const MODE: Record<RefreshMode, { statuses: string[]; sort: string; maxPages: number }> = {
  discovery: { statuses: ['ACTIVE', 'ANNOUNCED'], sort: 'endDate,asc', maxPages: 10 },
  manual: { statuses: ['ACTIVE', 'ANNOUNCED'], sort: 'endDate,asc', maxPages: 10 },
  live: { statuses: ['ACTIVE'], sort: 'endDate,asc', maxPages: 10 },
  closing: { statuses: ['ACTIVE'], sort: 'endDate,asc', maxPages: 2 },
  upcoming: { statuses: ['ANNOUNCED'], sort: 'endDate,asc', maxPages: 10 },
  ended: { statuses: ['SOLD', 'UNSOLD'], sort: 'endDate,desc', maxPages: 1 },
};

export const mazadat: Connector = {
  id: 'mazadat',
  name: 'مزادات',
  baseUrl: 'https://mazadat.sa',
  method: 'api',
  modes: ['discovery', 'manual', 'live', 'closing', 'upcoming', 'ended'],
  async fetchAuctions({ mode, log }) {
    const m = MODE[mode];
    const out: RawAuction[] = [];
    for (let page = 0; page < m.maxPages; page++) {
      const d: any = await getJson(`${API}/search?page=${page}&size=100&sort=${m.sort}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ $and: [{ status: { $in: m.statuses } }] }),
      });
      out.push(...(d.content ?? []).map(parseMazadatItem));
      log.debug({ page, n: d.content?.length, total: d.totalElements }, 'mazadat page');
      if (d.last !== false) break;
    }
    return out;
  },
};
