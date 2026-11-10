/**
 * إنفاذ — https://infath.gov.sa  (server-rendered HTML, read with Cheerio)
 *
 * Infath only answers requests from Saudi networks (connections from abroad are reset), so this
 * connector is marked `saudiOnly`: it runs on a computer inside Saudi Arabia (see scripts/infath-laptop/),
 * not on GitHub Actions or Netlify.
 *
 * List pages: /ar/auctions/?tab=ongoing|upcoming|ended  → cards with name, asset count, dates, region,
 *             city, asset type, auction type and a link /ar/auction?AuctionId=N.
 *             Each card has a countdown <div class="timer" data-end="YYYY-MM-DDTHH:MM:SS"> in Riyadh time.
 * Detail page: /ar/auction?AuctionId=N → assets (رقم الأصل, نوع الأصل, المساحة, المدينة, الحي, سعر البداية…)
 *             read by their labels; Infath hands execution to a licensed platform (e.g. mobasher.sa).
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

// ---- detail page: assets read by their labels --------------------------------------------
const LABELS: Record<string, keyof RawAsset | 'deed' | 'ignore'> = {
  'رقم الأصل': 'externalId', 'نوع الأصل': 'propertyType', 'نوع العقار': 'propertyType', 'المساحة': 'areaSqm', 'المدينة': 'city', 'الحي': 'district',
  'سعر البداية': 'startPrice', 'السعر الافتتاحي': 'startPrice', 'العربون': 'deposit', 'مبلغ التأمين': 'deposit', 'قيمة التأمين': 'deposit', 'الضمان': 'deposit',
  'رقم الصك': 'deed', 'المنطقة': 'region',
};

export function parseInfathDetail(html: string, auctionUrl: string): RawAsset[] {
  const $ = cheerio.load(html);
  $('script, style, select, option, svg').remove();
  const assets: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  // label elements are short headings/spans; their value is the next element's text
  $('h4, h5, h6, span, dt, th, strong, label, p').each((_, el) => {
    const label = cleanText($(el).clone().children().remove().end().text())?.replace(/[:：]$/, '');
    if (!label || label.length > 20) return;
    const key = Object.keys(LABELS).find((k) => label === k);
    if (!key) return;
    const value = cleanText($(el).next().text()) ?? cleanText($(el).parent().next().text());
    if (!value || value.length > 120) return;
    if (LABELS[key] === 'externalId') { cur = { externalId: value }; assets.push(cur); return; }
    const c = cur as Record<string, string> | null;
    if (c && !(LABELS[key] in c)) c[LABELS[key]] = value;
  });
  const links = $('a[href]').map((_, a) => $(a).attr('href')).get().filter((h) => /^https?:\/\//.test(h) && !h.includes('infath.gov.sa'));
  return assets.map((a, i) => {
    const title = [a.propertyType, a.district, a.city].filter(Boolean).join(' — ') || `أصل ${a.externalId}`;
    return {
      externalId: String(a.externalId ?? i + 1),
      title,
      url: links[0] ?? auctionUrl,
      city: a.city ?? null,
      region: a.region ?? null,
      district: a.district?.replace(/^حي\s+/, '') ?? null,
      startPrice: parseMoney(a.startPrice),
      deposit: parseMoney(a.deposit),
      areaSqm: parseArea(a.areaSqm),
      propertyType: mapPropertyType(a.propertyType),
      usage: mapUsage(a.propertyType),
      images: [],
    };
  });
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
      for (let page = 1; page <= 5; page++) {
        const html = await getText(`${BASE}/ar/auctions/?tab=${tab}${page > 1 ? `&page=${page}` : ''}`, { timeoutMs: 40_000 });
        const items = parseInfathList(html, tab);
        const fresh = items.filter((a) => !byId.has(a.externalId));
        fresh.forEach((a) => byId.set(a.externalId, a));
        log.debug({ tab, page, n: items.length, fresh: fresh.length }, 'infath page');
        if (!fresh.length || tab === 'ended') break; // no pagination / page param ignored
      }
    }
    // assets for active auctions (one request each)
    for (const a of byId.values()) {
      if (a.status === 'ended') continue;
      try {
        a.assets = parseInfathDetail(await getText(a.url, { timeoutMs: 40_000 }), a.url);
        if (a.assets.length && !a.assetCount) a.assetCount = a.assets.length;
        a.cities = uniq<string>([...(a.cities ?? []), ...a.assets.map((x) => x.city)]);
      } catch (e: any) {
        log.warn({ auction: a.externalId, err: e.message }, 'infath detail failed — auction kept without assets');
      }
    }
    return [...byId.values()];
  },
};
