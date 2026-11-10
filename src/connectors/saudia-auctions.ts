/**
 * السعودية للمزادات — https://www.auctions.com.sa  (Odoo backend)
 *   GET /en_US/api/parent/category                       → categories
 *   GET /en_US/api/get_auction_filter?state_key=&page=&categ_ids=  → published (current + coming) auctions
 * Dates are naive UTC ("YYYY-MM-DD HH:MM:SS"; server clock /api/get/datetime is +00:00).
 */
import { getJson } from '@/lib/http';
import { mapCategory, cleanText, uniq, type Category, type Status } from '@/lib/normalize';
import { parseUtcNaive } from '@/lib/time';
import type { Connector, RawAuction } from './types';

const BASE = 'https://www.auctions.com.sa';
const STATE: Record<string, Status> = { current: 'live', new: 'upcoming', coming: 'upcoming', ended: 'ended', end: 'ended', finished: 'ended' };

export function parseSaudiaItem(x: any, categoryHint?: Category): RawAuction {
  const districts = uniq<string>(String(x.neighborhood ?? '').split(/[,،]/).map((s: string) => cleanText(s)?.replace(/^حي\s+/, '') ?? null));
  const img = x.images?.[0]?.img_url as string | undefined;
  return {
    externalId: String(x.id),
    url: `${BASE}/auction_live/${x.id}`,
    title: cleanText(x.title) ?? `مزاد ${x.id}`,
    category: categoryHint ?? mapCategory(x.title),
    status: STATE[x.auction_state?.type] ?? null,
    startAt: parseUtcNaive(x.start_at),
    endAt: parseUtcNaive(x.end_at),
    region: cleanText(x.region),
    regions: uniq<string>([cleanText(x.region)]),
    city: cleanText(x.city),
    cities: uniq<string>([cleanText(x.city)]),
    districts,
    district: districts[0] ?? null,
    assetCount: typeof x.total_products === 'number' ? x.total_products : null,
    images: img ? [img.startsWith('http') ? img : BASE + img] : [],
    organizer: cleanText(x.executor?.name),
    raw: { id: x.id, auction_type: x.auction_type, state: x.auction_state?.type, charger: x.charger?.name, special: x.special_auction },
  };
}

function codeToCategory(c: any): Category {
  if (c.code === 'real_estate') return 'real_estate';
  return mapCategory(c.name, c.code);
}

export const saudiaAuctions: Connector = {
  id: 'saudia-auctions',
  name: 'السعودية للمزادات',
  baseUrl: BASE,
  method: 'api',
  modes: ['discovery', 'manual'],
  async fetchAuctions({ log }) {
    const cats: any = await getJson(`${BASE}/en_US/api/parent/category`);
    const byId = new Map<string, RawAuction>();
    const targets: { ids: string; cat?: Category }[] = (cats.data ?? []).map((c: any) => ({ ids: String(c.id), cat: codeToCategory(c) }));
    targets.push({ ids: '' }); // catch-all for auctions without a parent category
    for (const t of targets) {
      for (let page = 1; page <= 20; page++) {
        const qs = new URLSearchParams({ state_key: '', page: String(page), categ_ids: t.ids, pathname: '/' });
        const d: any = await getJson(`${BASE}/en_US/api/get_auction_filter?${qs}`);
        for (const x of d.data ?? []) if (!byId.has(String(x.id))) byId.set(String(x.id), parseSaudiaItem(x, t.cat));
        log.debug({ categ: t.ids, page, n: d.data?.length, pages: d.nb_page }, 'saudia page');
        if (!d.nb_page || page >= d.nb_page) break;
      }
    }
    return [...byId.values()];
  },
};
