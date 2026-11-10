/**
 * Generic mapper for unknown JSON auction payloads captured from a site's own API.
 * Used for sources whose API schema could not be inspected from this environment
 * (protected by bot challenges). It only copies values that actually exist.
 */
import { mapCategory, parseMoney, cleanText, uniq } from '@/lib/normalize';
import { parseIso, fromEpochMs, parseUtcNaive } from '@/lib/time';
import type { RawAuction } from './types';

const TITLE_KEYS = ['title', 'titleAr', 'title_ar', 'nameAr', 'name_ar', 'auction_name', 'auctionName', 'name'];
const START_KEYS = ['startDate', 'start_date', 'start_at', 'startAt', 'startTime', 'start_time', 'startTimeUtc', 'auctionStartDate'];
const END_KEYS = ['endDate', 'end_date', 'end_at', 'endAt', 'endTime', 'end_time', 'endTimeUtc', 'auctionEndDate', 'closingDate'];
const ID_KEYS = ['id', 'auctionId', 'auction_id', 'uuid', 'slug', 'code'];

const pick = (o: any, keys: string[]) => {
  for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k];
  return undefined;
};
const toDate = (v: any) => (typeof v === 'number' ? fromEpochMs(v > 1e12 ? v : v * 1000) : parseIso(v) ?? parseUtcNaive(v));
const str = (v: any) => (typeof v === 'string' ? cleanText(v) : v && typeof v === 'object' ? cleanText(v.ar ?? v.nameAr ?? v.name ?? null) : null);

function looksLikeAuction(o: any): boolean {
  return o && typeof o === 'object' && !Array.isArray(o) && pick(o, ID_KEYS) != null && typeof str(pick(o, TITLE_KEYS)) === 'string' && (pick(o, START_KEYS) != null || pick(o, END_KEYS) != null);
}

/** Walk a JSON document and return arrays whose elements look like auctions. */
export function findAuctionArrays(doc: unknown, depth = 0): any[][] {
  if (depth > 6 || doc == null || typeof doc !== 'object') return [];
  if (Array.isArray(doc)) {
    const hits = doc.filter(looksLikeAuction);
    if (hits.length && hits.length >= doc.length / 2) return [hits];
    return doc.flatMap((x) => findAuctionArrays(x, depth + 1));
  }
  return Object.values(doc as object).flatMap((v) => findAuctionArrays(v, depth + 1));
}

export function mapHeuristic(o: any, urlFor: (id: string, o: any) => string): RawAuction {
  const id = String(pick(o, ID_KEYS));
  const title = str(pick(o, TITLE_KEYS)) ?? `مزاد ${id}`;
  const city = str(o.city ?? o.cityName ?? o.city_name ?? o.cityNameAr);
  const region = str(o.region ?? o.regionName ?? o.region_name);
  const district = str(o.district ?? o.neighborhood ?? o.districtName);
  const img = pick(o, ['image', 'imageUrl', 'image_url', 'cover', 'coverImage', 'thumbnail', 'mainImage']);
  return {
    externalId: id,
    url: urlFor(id, o),
    title,
    category: mapCategory(str(o.category) ?? str(o.type) ?? str(o.categoryName), title),
    startAt: toDate(pick(o, START_KEYS)),
    endAt: toDate(pick(o, END_KEYS)),
    city, cities: uniq<string>([city]), region, regions: uniq<string>([region]), district, districts: uniq<string>([district]),
    assetCount: typeof (o.assetsCount ?? o.itemsCount ?? o.items_count ?? o.productCount) === 'number' ? (o.assetsCount ?? o.itemsCount ?? o.items_count ?? o.productCount) : null,
    startPrice: parseMoney(o.startPrice ?? o.start_price ?? o.openingPrice),
    currentPrice: parseMoney(o.currentPrice ?? o.current_price ?? o.highestBid ?? o.lastBid),
    deposit: parseMoney(o.deposit ?? o.downPayment ?? o.insuranceAmount),
    images: typeof img === 'string' ? [img] : [],
    organizer: str(o.organizer ?? o.seller ?? o.sellerName ?? o.company ?? o.owner),
    raw: { heuristic: true, keys: Object.keys(o).slice(0, 40) },
  };
}
