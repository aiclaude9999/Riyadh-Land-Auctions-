/**
 * إنفاذ — https://infath.gov.sa  (server-rendered HTML, read with Cheerio)
 *
 * Infath only answers requests from Saudi networks (connections from abroad are reset), so this
 * connector is marked `saudiOnly`: it runs on a computer inside Saudi Arabia (see scripts/infath-laptop/),
 * not on GitHub Actions or Netlify.
 *
 * List pages: /ar/auctions/?tab=ongoing|upcoming|ended[&pageNo=N] (9 per page) → cards with name, asset count, dates, region,
 *             city, asset type, auction type and a link /ar/auction?AuctionId=N.
 *             Each card has a countdown <div class="timer" data-end="YYYY-MM-DDTHH:MM:SS"> in Riyadh time.
 * Detail page: /ar/auction?AuctionId=N → one card per asset: type, area, entry deposit (مبلغ الدخول),
 *             description (district), Google Maps short link (coordinates). No per-asset opening price.
 */
import * as cheerio from 'cheerio';
import { getText } from '@/lib/http';
import { cleanText, mapCategory, mapPropertyType, mapUsage, parseArea, parseMoney, uniq, type Status } from '@/lib/normalize';
import { parseRiyadhLocal } from '@/lib/time';
import type { Connector, RawAsset, RawAuction, RefreshMode } from './types';

const BASE = 'https://infath.gov.sa';
const MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, أبريل: 4, إبريل: 4, مايو: 5, يونيو: 6, يوليو: 7, اغسطس: 8, أغسطس: 8, سبتمبر: 9, اكتوبر: 10, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};
const MULTI = /متعدد/;

/** "08 نوفمبر 2026 10:00:00" → { date: '2026-11-08', time: '10:00:00' } (time is 12-hour without AM/PM on the site). */
export function parseArabicDate(s?: string | null): { date: string; time: string | null } | null {
  if (!s) return null;
  const t = s.replace(/&nbsp;| /g, ' ').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = t.match(/(\d{1,2})\s+([؀-ۿ]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m || !MONTHS[m[2]]) return null;
  const date = `${m[3]}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return { date, time: m[4] ? `${m[4].padStart(2, '0')}:${m[5]}:${m[6] ?? '00'}` : null };
}

/** Resolve a 12-hour time without AM/PM: auctions run in the daytime, so 1–7 o'clock means afternoon. */
function to24h(time: string | null): string | null {
  if (!time) return null;
  const [h, m, s] = time.split(':').map(Number);
  const hh = h >= 1 && h <= 7 ? h + 12 : h;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s ?? 0).padStart(2, '0')}`;
}

const STATUS_FROM_TAG: [RegExp, Status][] = [[/جاري/, 'live'], [/قادم/, 'upcoming'], [/منته/, 'ended']];

export function parseInfathList(html: string, tab: string): RawAuction[] {
  const $ = cheerio.load(html);
  const out: RawAuction[] = [];
  $('.auction-single').each((_, el) => {
    const card = $(el);
    const href = card.find('a[href*="AuctionId="]').attr('href') ?? '';
    const id = href.match(/AuctionId=(\d+)/)?.[1];
    if (!id) return;
    const title = cleanText(card.find('.content h3').first().text()) ?? cleanText(card.find('h3').first().text()) ?? `مزاد إنفاذ ${id}`;
    const field = (label: string) => {
      let v: string | null = null;
      card.find('.auction-data .data').each((_, d) => {
        const h = cleanText($(d).find('h4').text());
        if (h && h.includes(label)) v = cleanText($(d).find('p, time').first().text());
      });
      return v as string | null;
    };
    const startTxt = parseArabicDate(card.find('time.date').eq(0).text());
    const endTxt = parseArabicDate(card.find('time.date').eq(1).text());
    const timerEnd = card.find('[data-end]').attr('data-end') ?? null; // exact Riyadh local time (24h)
    const timerDate = timerEnd?.slice(0, 10);
    // the countdown points at the end for live auctions and at the start for upcoming ones
    const end = timerEnd && endTxt && timerDate === endTxt.date ? parseRiyadhLocal(timerDate, timerEnd.slice(11)) : endTxt ? parseRiyadhLocal(endTxt.date, to24h(endTxt.time)) : null;
    const start = timerEnd && startTxt && timerDate === startTxt.date && timerDate !== endTxt?.date ? parseRiyadhLocal(timerDate, timerEnd.slice(11)) : startTxt ? parseRiyadhLocal(startTxt.date, to24h(startTxt.time)) : null;
    const tag = cleanText(card.find('.service-tag').text()) ?? '';
    const status = STATUS_FROM_TAG.find(([re]) => re.test(tag))?.[1] ?? ({ ongoing: 'live', upcoming: 'upcoming', ended: 'ended' } as Record<string, Status>)[tab] ?? null;
    const region = field('المنطقة'), city = field('المدينة'), assetType = field('نوع الأصل');
    const count = Number(cleanText(card.find('.count-badge').text()) ?? NaN);
    const img = card.find('img').attr('src');
    out.push({
      externalId: id,
      url: `${BASE}/ar/auction?AuctionId=${id}`,
      title,
      category: mapCategory(assetType, title), // the 'فرصة عقارية' badge text is shown on every card, even vehicles
      status,
      startAt: start,
      endAt: end,
      region: region && !MULTI.test(region) ? region : null,
      regions: region && !MULTI.test(region) ? [region] : [],
      city: city && !MULTI.test(city) ? city : null,
      cities: city && !MULTI.test(city) ? [city] : [],
      assetCount: Number.isFinite(count) && count > 0 ? count : null,
      images: img && !img.endsWith('.svg') ? [img.startsWith('http') ? img : BASE + img] : [],
      organizer: 'مركز الإسناد والتصفية (إنفاذ)',
      crossRefs: [`infath:${id}`],
      raw: { id, tab, tag, assetType, auctionType: field('نوع المزاد'), timerEnd, multiCity: !!city && MULTI.test(city) },
    });
  });
  return out;
}

// ---- detail page: one card per asset ------------------------------------------------------
// Real layout (Nov 2026): section.auctions-small-cards → .ac-card, each with the asset type in the
// accordion button, "موقع الأصل" (Google Maps short link), "مبلغ الدخول" (entry deposit), deed number,
// "المساحة" (p label + h4 value with <sup>2</sup>), "وصف العقار" and "الملاحظات". No per-asset price.

/** "أرض سكنية حي ظهرة لبن بالرياض" → "ظهرة لبن" */
export function districtFromText(text?: string | null): string | null {
  const m = text?.match(/حي\s+([^\n،,.()]+?)\s+(?:ب|في\s+)?(?:مدينة\s+)?ال?رياض/);
  return m ? cleanText(m[1]) : null;
}

/** Coordinates from a full Google Maps URL (…/@24.6,46.7,… · ?q=24.6,46.7 · !3d24.6!4d46.7). */
export function coordsFromMapsUrl(url?: string | null): { lat: number; lng: number } | null {
  if (!url) return null;
  const u = decodeURIComponent(url);
  const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    ?? u.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
    ?? u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    ?? u.match(/\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  // Saudi Arabia only (guards against swapped / unrelated numbers)
  return lat > 15 && lat < 33 && lng > 34 && lng < 56 ? { lat, lng } : null;
}

export interface InfathAsset extends RawAsset { mapUrl: string | null }

export function parseInfathDetail(html: string, auctionUrl: string): InfathAsset[] {
  const $ = cheerio.load(html);
  // auction-level facts (header card): <h4>label</h4><p>value</p>
  const facts: Record<string, string> = {};
  $('section.ac-big-card').not('.auctions-small-cards').find('.info-item .data').each((_, el) => {
    const k = cleanText($(el).find('h4').first().text());
    const v = cleanText($(el).find('p').first().text());
    if (k && v && !(k in facts)) facts[k] = v;
  });
  const districtOptions = $('select[name="district"] option').map((_, o) => cleanText($(o).attr('value'))).get().filter(Boolean) as string[];
  const auctionDistrict = districtOptions.length === 1 ? districtOptions[0] : null;
  const city = facts['المدينة'] ?? null;

  return $('section.auctions-small-cards .ac-card').map((i, el) => {
    const card = $(el);
    const type = cleanText(card.find('.accordion-button').first().text());
    const deed = cleanText(card.find('.a-deed .data p').first().text());
    let area: number | null = null;
    card.find('.info-item .data').each((_, d) => {
      if (cleanText($(d).find('p').first().text()) !== 'المساحة') return;
      const h = $(d).find('h4').first().clone();
      h.find('sup').remove(); // "560 م<sup>2</sup>" — don't read the ² as a digit
      area = parseArea(h.text());
    });
    const sections: Record<string, string> = {};
    card.find('h3').each((_, h) => {
      const k = cleanText($(h).text());
      const v = $(h).nextAll('p').map((_, p) => cleanText($(p).text())).get().filter(Boolean).join('\n');
      if (k && v && !(k in sections)) sections[k] = v;
    });
    const desc = sections['وصف العقار'] ?? null;
    const district = districtFromText(desc) ?? auctionDistrict;
    const mapUrl = card.find('a[href*="maps"], a[href*="goo.gl"]').first().attr('href') ?? null;
    const coords = coordsFromMapsUrl(mapUrl);
    const detail = desc?.split(/\n|\s+الدور\s/)[0].replace(/^تفاصيل العقار\s*:\s*/, '').trim();
    const pt = mapPropertyType(type, desc);
    const title = [type, district && `حي ${district}`].filter(Boolean).join(' — ')
      + (pt !== 'land' && detail ? ` (${detail.length > 70 ? detail.slice(0, 70) + '…' : detail})` : '');
    return {
      externalId: deed ?? String(i + 1),
      title: title || `أصل ${i + 1}`,
      url: auctionUrl,
      city,
      region: null,
      district,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      startPrice: null,
      deposit: parseMoney(card.find('a.btn-share').first().text()),
      areaSqm: area,
      propertyType: pt,
      usage: mapUsage(type, desc),
      images: [],
      mapUrl,
    } satisfies InfathAsset;
  }).get();
}

/**
 * Infath links each asset to a Google Maps short link (maps.app.goo.gl/…). Its redirect target is a
 * normal Google Maps URL that usually contains the coordinates; read them from the Location header
 * (no page content is downloaded). Best effort: any failure just leaves the asset without a pin.
 */
export async function resolveMapsLink(url: string, timeoutMs = 10_000): Promise<{ lat: number; lng: number } | null> {
  let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    const direct = coordsFromMapsUrl(cur);
    if (direct) return direct;
    if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|www\.google\.com)\//.test(cur)) return null;
    const res = await fetch(cur, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    await res.body?.cancel();
    const loc = res.headers.get('location');
    if (!loc) return null;
    cur = new URL(loc, cur).toString();
  }
  return coordsFromMapsUrl(cur);
}

const MAX_PAGES = 15;
const DETAIL_BUDGET_MS = 6 * 60_000; // all detail pages + map links of one run
const MAX_MAP_LOOKUPS = 150;

/** Highest page number in the list's pagination (links like "?tab=ongoing&pageNo=4"); 1 when there is none. */
export function lastPageNumber(html: string): number {
  const nums = [...html.matchAll(/(?:[?&;]|&amp;)pageNo=(\d+)/g)].map((m) => Number(m[1]));
  return Math.max(1, ...nums);
}

const MODE_TABS: Record<RefreshMode, string[]> = {
  discovery: ['ongoing', 'upcoming'], manual: ['ongoing', 'upcoming'], live: ['ongoing'], closing: ['ongoing'], upcoming: ['upcoming'], ended: ['ended'],
};

export const infath: Connector = {
  id: 'infath',
  name: 'إنفاذ',
  baseUrl: BASE,
  method: 'html',
  saudiOnly: true,
  modes: ['discovery', 'manual', 'live', 'closing', 'upcoming', 'ended'],
  async fetchAuctions({ mode, log }) {
    const byId = new Map<string, RawAuction>();
    for (const tab of MODE_TABS[mode]) {
      // 9 cards per page; pages are ?tab=…&pageNo=N (seen on the real site, Nov 2026)
      let last = 1;
      for (let page = 1; page <= Math.min(last, tab === 'ended' ? 1 : MAX_PAGES); page++) {
        const html = await getText(`${BASE}/ar/auctions/?tab=${tab}${page > 1 ? `&pageNo=${page}` : ''}`, { timeoutMs: 25_000, retries: 1 });
        if (page === 1) last = lastPageNumber(html);
        const items = parseInfathList(html, tab);
        const fresh = items.filter((a) => !byId.has(a.externalId));
        fresh.forEach((a) => byId.set(a.externalId, a));
        log.debug({ tab, page, last, n: items.length, fresh: fresh.length }, 'infath page');
        if (!fresh.length) break; // page ignored / nothing new
      }
    }
    // assets for active auctions (one request each)
    // Time budget: Infath is sometimes slow or answers 503; never let one run hang for long.
    const deadline = Date.now() + DETAIL_BUDGET_MS;
    let failures = 0, mapLookups = 0;
    for (const a of byId.values()) {
      if (a.status === 'ended') continue;
      if (Date.now() > deadline || failures >= 3) {
        log.warn({ failures }, 'infath details stopped early (time budget / repeated failures) — next run continues');
        break;
      }
      try {
        const assets = parseInfathDetail(await getText(a.url, { timeoutMs: 20_000, retries: 1 }), a.url);
        failures = 0;
        for (const asset of assets) {
          if (asset.latitude != null || !asset.mapUrl || mapLookups >= MAX_MAP_LOOKUPS || Date.now() > deadline) continue;
          mapLookups++;
          try {
            const c = await resolveMapsLink(asset.mapUrl, 5_000);
            if (c) { asset.latitude = c.lat; asset.longitude = c.lng; }
          } catch { /* no pin for this asset */ }
        }
        a.assets = assets.map(({ mapUrl: _m, ...rest }) => rest);
        log.debug({ auction: a.externalId, assets: assets.length, withPin: assets.filter((x) => x.latitude != null).length }, 'infath detail');
        if (a.assets.length && !a.assetCount) a.assetCount = a.assets.length;
        a.cities = uniq<string>([...(a.cities ?? []), ...a.assets.map((x) => x.city)]);
      } catch (e: any) {
        failures++;
        log.warn({ auction: a.externalId, err: e.message }, 'infath detail failed — auction kept without assets');
      }
    }
    return [...byId.values()];
  },
};
