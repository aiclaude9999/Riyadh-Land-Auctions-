/**
 * ترسية — https://tarsyah.sa  (www.tarsyah.com redirects here; Nuxt front-end)
 *   GET https://admin.tarsyah.sa/api/v1/auctions?limit=30&page=N   (page-based; images_prefix in response)
 * The list has no structured city field — the location is taken only from the auction's own
 * name / address / description text (e.g. "البديعة والملقا، الرياض") and coordinates when present.
 */
import { getJson } from '@/lib/http';
import { mapCategory, cleanText, uniq, type Status } from '@/lib/normalize';
import { citiesInText, districtsInText } from '@/lib/geo';
import { parseIso } from '@/lib/time';
import type { Connector, RawAuction } from './types';

const API = 'https://admin.tarsyah.sa/api/v1/auctions';
const STATUS: Record<string, Status> = { current: 'live', upcoming: 'upcoming', coming: 'upcoming', soon: 'upcoming', finished: 'ended', ended: 'ended' };

export function parseTarsyahItem(x: any, imagesPrefix = 'https://admin.tarsyah.sa/storage/'): RawAuction {
  const title = cleanText(x.display_name ?? x.name) ?? `مزاد ${x.id}`;
  const text = [x.name, x.address, x.description].filter(Boolean).join(' — ');
  const cities = citiesInText(text);
  const districts = districtsInText(text);
  const num = (v: any) => (v == null || v === '' ? null : Number(v));
  return {
    externalId: String(x.id),
    url: `https://tarsyah.sa/auctions/${x.id}`,
    title,
    category: mapCategory(x.type_name, title),
    status: STATUS[x.status_key] ?? null,
    startAt: parseIso(x.start_at),
    endAt: parseIso(x.end_at),
    cities,
    city: cities[0] ?? null,
    districts,
    district: districts[0] ?? null,
    locationText: cleanText(x.address),
    latitude: num(x.latitude),
    longitude: num(x.longitude),
    assetCount: typeof x.items_count === 'number' ? x.items_count : null,
    images: x.image ? [String(x.image).startsWith('http') ? x.image : imagesPrefix + x.image] : [],
    organizer: null,
    crossRefs: x.id_number ? [`tarsyah:${x.id_number}`] : [],
    raw: { id: x.id, id_number: x.id_number, type_name: x.type_name, status_key: x.status_key, bid_method_name: x.bid_method_name, url_map: x.url_map },
  };
}

export const tarsyah: Connector = {
  id: 'tarsyah',
  name: 'ترسية',
  baseUrl: 'https://tarsyah.sa',
  method: 'api',
  modes: ['discovery', 'manual'],
  async fetchAuctions({ mode, log }) {
    const out: RawAuction[] = [];
    const maxPages = mode === 'ended' ? 1 : 10; // newest first; older pages are long-finished
    for (let page = 1; page <= maxPages; page++) {
      const d: any = await getJson(`${API}?limit=30&page=${page}`);
      const items = d.content ?? [];
      out.push(...items.map((x: any) => parseTarsyahItem(x, d.images_prefix)));
      log.debug({ page, n: items.length, pages: d.paginator?.total_page }, 'tarsyah page');
      // stop when the page is only finished auctions (list is sorted newest first) or no more pages
      if (page >= (d.paginator?.total_page ?? 1) || items.every((x: any) => x.status_key === 'finished')) break;
    }
    return out;
  },
};
