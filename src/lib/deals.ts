/**
 * Ministry of Justice (MoJ) real-estate sales ("الصفقات العقارية") → Riyadh-city district summaries.
 *
 * The MoJ open-data files (open.data.gov.sa, one per quarter) list every sale with region, city,
 * "city / district", date, classification (سكني / تجاري / زراعي), number of properties, price and area.
 * They have NO property type and NO coordinates, so we summarise per district and place each district
 * at its centroid (src/data/riyadh-district-centroids.json).
 *
 * "Land" is an estimate: residential single-property deals with area > 200 m² (checked on the 2023 MoJ
 * files, which still had a property-type column: ~96% correct for Riyadh city).
 */
import { normalizeArabic, parseMoney } from './normalize';
import { placeKey } from './geo';

export interface MojRow {
  region: string;
  city: string;
  district: string;
  classification: string;
  properties: number;
  price: number | null;
  area: number | null;
}

export interface DistrictPoint { name: string; nameEn?: string; lat: number; lng: number }

/** One district in one period (a quarter like "2026-Q2", or "all"). Short keys keep the JSON small. */
export interface DistrictDeals {
  q: string;
  d: string; // district name (as on the map)
  lat: number;
  lng: number;
  n: number; // deals
  v: number; // total value SAR
  m: number | null; // median SAR/m² (all deals with a usable price and area)
  nl: number; // estimated land deals
  ml: number | null; // median SAR/m² of estimated land deals
  nr: number; // residential
  nc: number; // commercial
}

export interface DealsData {
  generatedAt: string;
  source: string;
  quarters: { q: string; riyadhDeals: number; mapped: number }[];
  rows: DistrictDeals[];
  /** deals whose district could not be placed on the map, per period */
  unmapped: { q: string; d: string; n: number }[];
}

export const LAND_MIN_AREA = 200;

/** Minimal CSV parser (quoted fields, "" escapes, CRLF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x !== '')) out.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) out.push(row);
  return out;
}

/** Parse one MoJ sales CSV. Columns are found by name (their order and date-column names vary by quarter). */
export function parseMojCsv(text: string): MojRow[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const idx = (name: string) => head.findIndex((h) => h.trim() === name);
  const iRegion = idx('المنطقة'), iCity = idx('المدينة'), iCD = idx('المدينة / الحي'), iCls = idx('تصنيف العقار');
  const iN = idx('عدد العقارات'), iPrice = idx('السعر'), iArea = idx('المساحة');
  if ([iCity, iCD, iPrice, iArea].some((i) => i < 0)) throw new Error('Unexpected MoJ CSV header: ' + head.join(','));
  return rows.map((r) => {
    const cd = (r[iCD] ?? '').trim();
    const slash = cd.indexOf('/');
    return {
      region: (r[iRegion] ?? '').trim(),
      city: (r[iCity] ?? '').trim(),
      district: (slash >= 0 ? cd.slice(slash + 1) : cd).trim(),
      classification: (r[iCls] ?? '').trim(),
      properties: Number(r[iN]) || 1,
      price: parseMoney(r[iPrice]),
      area: parseMoney(r[iArea]),
    };
  });
}

/** Key for matching a district name across spellings: "حي الصفاء" == "الصفا", "المعيزلة" == "المعيزله". */
export function districtKey(name: string): string {
  return placeKey(name).replace(/اء$/, 'ا');
}

/** MoJ spellings that differ from the address-map names (key → key, or several keys = average position). */
const ALIASES: Record<string, string[]> = {
  [districtKey('مطار الملك خالد الدولي')]: ['مطار الملك خالد'],
  [districtKey('النسيم')]: ['النسيم الشرقي', 'النسيم الغربي'],
  [districtKey('ام الحمام')]: ['ام الحمام الشرقي', 'ام الحمام الغربي'],
  [districtKey('غبيراء')]: ['غبيرة'],
  [districtKey('المعيزليه')]: ['المعيزلة'],
  [districtKey('سدره')]: ['السدرة'],
  [districtKey('المدينه الصناعيه الجديده')]: ['المدينة الصناعية الثانية'],
  [districtKey('الملك عبد الله')]: ['الملك عبدالله'],
};

export function makeLocator(points: DistrictPoint[]) {
  const byKey = new Map(points.map((p) => [districtKey(p.name), p] as const));
  return (district: string): { name: string; lat: number; lng: number } | null => {
    const k = districtKey(district);
    const hit = byKey.get(k);
    if (hit) return { name: hit.name.replace(/^حي\s+/, ''), lat: hit.lat, lng: hit.lng };
    const alias = ALIASES[k]?.map((a) => byKey.get(districtKey(a))).filter((p): p is DistrictPoint => !!p);
    if (alias?.length) {
      return {
        name: district.trim(),
        lat: alias.reduce((s, p) => s + p.lat, 0) / alias.length,
        lng: alias.reduce((s, p) => s + p.lng, 0) / alias.length,
      };
    }
    return null;
  };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** SAR per m², or null when price/area are missing or clearly not a real per-m² value. */
export function pricePerSqm(r: MojRow): number | null {
  if (r.price == null || r.area == null || r.area < 20 || r.price < 10_000) return null;
  const v = r.price / r.area;
  return v >= 20 && v <= 200_000 ? v : null;
}

export function isEstimatedLand(r: MojRow): boolean {
  return r.classification === 'سكني' && r.properties === 1 && r.area != null && r.area > LAND_MIN_AREA;
}

export function isRiyadhCityRow(r: MojRow): boolean {
  return normalizeArabic(r.city) === normalizeArabic('الرياض');
}

/** Summarise several quarters of MoJ rows into per-district records (plus an "all" period). */
export function summariseDeals(quarters: { q: string; rows: MojRow[] }[], points: DistrictPoint[], now = new Date()): DealsData {
  const locate = makeLocator(points);
  type Acc = { d: string; lat: number; lng: number; n: number; v: number; ppm: number[]; nl: number; ppmL: number[]; nr: number; nc: number };
  const acc = new Map<string, Acc>();
  const unmapped = new Map<string, number>();
  const qInfo: DealsData['quarters'] = [];

  const add = (q: string, loc: { name: string; lat: number; lng: number }, r: MojRow) => {
    const key = q + '|' + loc.name;
    let a = acc.get(key);
    if (!a) acc.set(key, (a = { d: loc.name, lat: loc.lat, lng: loc.lng, n: 0, v: 0, ppm: [], nl: 0, ppmL: [], nr: 0, nc: 0 }));
    a.n++;
    a.v += r.price ?? 0;
    const ppm = pricePerSqm(r);
    if (ppm != null) a.ppm.push(ppm);
    if (isEstimatedLand(r)) { a.nl++; if (ppm != null) a.ppmL.push(ppm); }
    if (r.classification === 'سكني') a.nr++;
    else if (r.classification === 'تجاري') a.nc++;
  };

  for (const { q, rows } of quarters) {
    const riyadh = rows.filter(isRiyadhCityRow);
    let mapped = 0;
    for (const r of riyadh) {
      const loc = locate(r.district);
      if (!loc) {
        for (const p of [q, 'all']) unmapped.set(p + '|' + (r.district || '—'), (unmapped.get(p + '|' + (r.district || '—')) ?? 0) + 1);
        continue;
      }
      mapped++;
      add(q, loc, r);
      add('all', loc, r);
    }
    qInfo.push({ q, riyadhDeals: riyadh.length, mapped });
  }

  const round = (x: number | null) => (x == null ? null : Math.round(x));
  const rows: DistrictDeals[] = [...acc.entries()].map(([key, a]) => ({
    q: key.slice(0, key.indexOf('|')), d: a.d, lat: +a.lat.toFixed(5), lng: +a.lng.toFixed(5), n: a.n, v: Math.round(a.v),
    m: round(median(a.ppm)), nl: a.nl, ml: round(median(a.ppmL)), nr: a.nr, nc: a.nc,
  }));
  rows.sort((x, y) => x.q.localeCompare(y.q) || y.n - x.n);
  return {
    generatedAt: now.toISOString(),
    source: 'وزارة العدل — الصفقات العقارية (open.data.gov.sa)',
    quarters: qInfo,
    rows,
    unmapped: [...unmapped.entries()].map(([k, n]) => ({ q: k.slice(0, k.indexOf('|')), d: k.slice(k.indexOf('|') + 1), n })).sort((a, b) => b.n - a.n),
  };
}

/** Centroid (lat, lng) of a polygon ring given as [lat, lng] points (area-weighted; falls back to the vertex mean). */
export function ringCentroid(ring: [number, number][]): { lat: number; lng: number; area: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [y0, x0] = ring[j];
    const [y1, x1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = ring.length || 1;
    return { lat: ring.reduce((s, p) => s + p[0], 0) / n, lng: ring.reduce((s, p) => s + p[1], 0) / n, area: 0 };
  }
  return { lat: cy / (3 * a), lng: cx / (3 * a), area: Math.abs(a / 2) };
}
