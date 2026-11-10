/**
 * قمة للمزادات — https://qemah.sa  (Laravel; server-rendered pages + same-origin JSON endpoints)
 *   GET https://qemah.sa/auctions/{live|upcoming|finished}?page=N   (Accept: application/json, X-Requested-With)
 * Auctions of vehicles and car plates. The listing exposes only a start date/time (Riyadh local) and
 * a total count — there is no end time and no location. Lot records contain owners' document
 * uploads, so ONLY auction-level fields are read; nothing personal is stored.
 */
import { getJson } from '@/lib/http';
import { cleanText, type Status } from '@/lib/normalize';
import { parseRiyadhLocal } from '@/lib/time';
import type { Connector, RawAuction, RefreshMode } from './types';

const BASE = 'https://qemah.sa';
const TYPES: Record<string, Status> = { live: 'live', upcoming: 'upcoming', finished: 'ended' };

export function parseQemahItem(x: any, type: string): RawAuction {
  const cat = x.category === 'cars' ? 'vehicle' : x.category === 'car_plates' ? 'collectible' : 'other';
  return {
    externalId: String(x.id),
    url: `${BASE}/auctions/${type}?category=${encodeURIComponent(x.category ?? '')}&auction_id=${x.id}`,
    title: cleanText(x.auction_name) ?? `مزاد ${x.id}`,
    category: cat,
    status: TYPES[type] ?? null,
    startAt: parseRiyadhLocal(x.start_date, x.start_time),
    endAt: null,
    assetCount: typeof x.total_cars === 'number' ? x.total_cars : null,
    images: [],
    organizer: 'قمة للمزادات',
    raw: { id: x.id, category: x.category, status: x.status, auction_type: x.auction_type, start_date: x.start_date, start_time: x.start_time },
  };
}

const MODE_TYPES: Record<RefreshMode, string[]> = {
  discovery: ['live', 'upcoming'], manual: ['live', 'upcoming'], live: ['live'], closing: ['live'], upcoming: ['upcoming'], ended: ['finished'],
};

export const qemah: Connector = {
  id: 'qemah',
  name: 'قمة',
  baseUrl: BASE,
  method: 'html',
  modes: ['discovery', 'manual', 'live', 'closing', 'upcoming', 'ended'],
  async fetchAuctions({ mode, log }) {
    const out: RawAuction[] = [];
    for (const type of MODE_TYPES[mode]) {
      for (let page = 1; page <= (type === 'finished' ? 1 : 5); page++) {
        const d: any = await getJson(`${BASE}/auctions/${type}?page=${page}`, {
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        out.push(...(d.data ?? []).map((x: any) => parseQemahItem(x, type)));
        log.debug({ type, page, n: d.data?.length }, 'qemah page');
        if (!d.hasMore) break;
      }
    }
    return out;
  },
};
