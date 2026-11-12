/**
 * Bidding insights for one asset (Riyadh city only — the deal prices cover Riyadh city):
 *  - district of the asset (from its map point inside the district boundaries, else its district name)
 *  - price check for land: plot SAR/m² vs the district's median land price (MoJ deals, estimate)
 *  - suggested maximum bid = district price × area, minus typical buyer costs
 *  - nearest Riyadh Metro station
 *  - white-land fee warning (land ≥ 5,000 m²)
 * Everything here is a guide, never a valuation; the UI says so.
 */
import dealsJson from '@/data/riyadh-deals.json';
import shapesJson from '@/data/riyadh-district-shapes.json';
import metroJson from '@/data/riyadh-metro.json';
import { districtKey, type DealsData, type DistrictDeals } from './deals';

/** Typical buyer costs on top of the winning bid: commission 2.5% + 15% VAT on it, real estate transaction tax 5%. */
export const COSTS = { commission: 0.025, vatOnCommission: 0.15, rett: 0.05 };
export const COST_RATE = COSTS.commission * (1 + COSTS.vatOnCommission) + COSTS.rett; // 0.07875
export const NEAR_BAND = 0.15; // ±15% = "near market"
export const MIN_DEALS = 3;
export const WHITE_LAND_MIN_AREA = 5000;

/** Major Riyadh projects (locations from OpenStreetMap, Nov 2026). Expo 2030 site is not mapped yet → left out. */
export const PROJECTS = [
  { name: 'حديقة الملك سلمان', lat: 24.7228, lng: 46.7190 },
  { name: 'مركز الملك عبدالله المالي', lat: 24.7657, lng: 46.6407 },
  { name: 'الدرعية (حي الطريف)', lat: 24.7330, lng: 46.5734 },
  { name: 'المربع الجديد', lat: 24.8106, lng: 46.5702 },
  { name: 'مطار الملك خالد الدولي', lat: 24.9586, lng: 46.7110 },
];

type Shape = { name: string; rings: [number, number][][] };
type MetroLine = { ref: string; name: string; colour: string; stations: { name: string; lat: number; lng: number }[] };

const deals = dealsJson as unknown as DealsData;
const shapes = shapesJson as unknown as Shape[];
const metro = (metroJson as unknown as { lines: MetroLine[] }).lines;

// district boundary name → deals row of the combined period
const dealsByShape = new Map<string, DistrictDeals>();
const quarterRows = new Map<string, DistrictDeals[]>(); // district boundary name → rows per quarter (oldest first)
for (const r of deals.rows) {
  if (r.q === 'all') r.p.forEach((n) => dealsByShape.set(n, r));
  else r.p.forEach((n) => quarterRows.set(n, [...(quarterRows.get(n) ?? []), r].sort((a, b) => a.q.localeCompare(b.q))));
}

/** District median per quarter (land estimate or commercial), only quarters with enough deals. */
export function districtTrend(shapeName: string, kind: 'land' | 'commercial' = 'land'): { q: string; ppm: number; n: number }[] {
  return (quarterRows.get(shapeName) ?? [])
    .map((r) => (kind === 'commercial' ? { q: r.q, ppm: r.mc, n: r.nc } : { q: r.q, ppm: r.ml, n: r.nl }))
    .filter((x): x is { q: string; ppm: number; n: number } => x.ppm != null && x.n >= MIN_DEALS);
}
const shapeByKey = new Map(shapes.map((s) => [districtKey(s.name), s] as const));
const stations = metro.flatMap((l) => l.stations.map((s) => ({ ...s, name: s.name.replace(/^محطة\s+/, ''), line: l.name, colour: l.colour })));

function inRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Riyadh district boundary containing the point, else the one matching the district name. */
export function findDistrict(lat?: number | null, lng?: number | null, name?: string | null): Shape | null {
  if (lat != null && lng != null) {
    for (const s of shapes) if (s.rings.some((r) => inRing(lat, lng, r))) return s;
  }
  return name ? shapeByKey.get(districtKey(name)) ?? null : null;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStation(lat: number, lng: number) {
  let best: { name: string; line: string; colour: string; km: number } | null = null;
  for (const s of stations) {
    const km = haversineKm(lat, lng, s.lat, s.lng);
    if (!best || km < best.km) best = { name: s.name, line: s.line, colour: s.colour, km };
  }
  return best;
}

export interface InsightInput {
  propertyType?: string | null; usage?: string | null; areaSqm?: number | null;
  startPrice?: number | null; currentPrice?: number | null;
  district?: string | null; geoScope?: string | null; latitude?: number | null; longitude?: number | null;
}

export interface Insights {
  district?: string;
  /** district median SAR/m² (MoJ deals, all quarters): residential land (estimate) or commercial deals */
  benchPpm?: number; benchDeals?: number; benchKind?: 'land' | 'commercial';
  plotPpm?: number;
  diffPct?: number; // (plot − district) / district
  verdict?: 'below' | 'near' | 'above';
  /** district price × area, minus typical costs */
  maxBid?: number;
  metro?: { name: string; line: string; colour: string; km: number };
  whiteLand?: boolean;
  /** the two nearest major projects within 15 km */
  projects?: { name: string; km: number }[];
  /** district median by quarter (same kind as the benchmark) */
  trend?: { q: string; ppm: number; n: number }[];
}

export function assetInsights(a: InsightInput): Insights | null {
  const inRiyadh = a.geoScope === 'riyadh_city';
  if (!inRiyadh) return null;
  const out: Insights = {};
  const shape = findDistrict(a.latitude, a.longitude, a.district);
  if (shape) out.district = shape.name.replace(/^حي\s+/, '');
  const isLand = a.propertyType === 'land';
  const row = isLand && shape ? dealsByShape.get(shape.name) : undefined;
  // residential (or unknown) land → land estimate; commercial land → commercial deals; others: no benchmark
  const bench = !row ? null
    : a.usage === 'commercial' ? (row.mc != null && row.nc >= MIN_DEALS ? { ppm: row.mc, n: row.nc, kind: 'commercial' as const } : null)
    : !a.usage || a.usage === 'residential' ? (row.ml != null && row.nl >= MIN_DEALS ? { ppm: row.ml, n: row.nl, kind: 'land' as const } : null)
    : null;
  if (bench) {
    {
      out.benchPpm = bench.ppm;
      out.benchDeals = bench.n;
      out.benchKind = bench.kind;
      const t = districtTrend(shape!.name, bench.kind);
      if (t.length >= 2) out.trend = t;
      if (a.areaSqm && a.areaSqm > 0) {
        out.maxBid = Math.round((bench.ppm * a.areaSqm) / (1 + COST_RATE) / 1000) * 1000;
        const price = a.currentPrice ?? a.startPrice;
        if (price && price > 0) {
          out.plotPpm = Math.round(price / a.areaSqm);
          out.diffPct = (out.plotPpm - bench.ppm) / bench.ppm;
          out.verdict = out.diffPct <= -NEAR_BAND ? 'below' : out.diffPct >= NEAR_BAND ? 'above' : 'near';
        }
      }
    }
  }
  if (a.latitude != null && a.longitude != null) {
    const s = nearestStation(a.latitude, a.longitude);
    if (s && s.km <= 15) out.metro = { ...s, km: Math.round(s.km * 10) / 10 };
    const near = PROJECTS.map((p) => ({ name: p.name, km: Math.round(haversineKm(a.latitude!, a.longitude!, p.lat, p.lng) * 10) / 10 }))
      .filter((p) => p.km <= 15).sort((x, y) => x.km - y.km).slice(0, 2);
    if (near.length) out.projects = near;
  }
  if (isLand && (a.areaSqm ?? 0) >= WHITE_LAND_MIN_AREA) out.whiteLand = true;
  return Object.keys(out).length ? out : null;
}
