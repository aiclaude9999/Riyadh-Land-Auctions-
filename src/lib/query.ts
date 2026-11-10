import { Prisma } from '@prisma/client';
import { riyadhDayBounds } from './time';
import { normalizeArabic } from './normalize';

export interface AuctionQuery {
  geo?: string; category?: string[]; source?: string[]; status?: string[]; city?: string; district?: string; organizer?: string; q?: string;
  startFrom?: string; startTo?: string; endFrom?: string; endTo?: string; minPrice?: string; maxPrice?: string;
  sort?: string; page?: number; pageSize?: number; saved?: boolean; endingToday?: boolean; newSince?: string;
}

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
const date = (v?: string) => {
  if (!v) return undefined;
  // date-only values are interpreted as Riyadh midnight
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+03:00`) : new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

export function parseQuery(sp: URLSearchParams): AuctionQuery {
  return {
    geo: sp.get('geo') ?? undefined, category: list(sp.get('category')), source: list(sp.get('source')), status: list(sp.get('status')),
    city: sp.get('city') ?? undefined, district: sp.get('district') ?? undefined, organizer: sp.get('organizer') ?? undefined, q: sp.get('q') ?? undefined,
    startFrom: sp.get('startFrom') ?? undefined, startTo: sp.get('startTo') ?? undefined, endFrom: sp.get('endFrom') ?? undefined, endTo: sp.get('endTo') ?? undefined,
    minPrice: sp.get('minPrice') ?? undefined, maxPrice: sp.get('maxPrice') ?? undefined, sort: sp.get('sort') ?? undefined,
    page: Math.max(1, Number(sp.get('page') ?? 1) || 1), pageSize: Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? 24) || 24)),
    saved: sp.get('saved') === '1', endingToday: sp.get('endingToday') === '1', newSince: sp.get('newSince') ?? undefined,
  };
}

export function geoWhere(geo?: string): Prisma.AuctionWhereInput {
  if (geo === 'all') return {};
  if (geo === 'riyadh_region') return { hasRiyadhRegion: true };
  return { hasRiyadhCity: true };
}

export function buildWhere(q: AuctionQuery): Prisma.AuctionWhereInput {
  const and: Prisma.AuctionWhereInput[] = [geoWhere(q.geo)];
  if (q.category?.length) and.push({ category: { in: q.category } });
  if (q.status?.length) and.push({ status: { in: q.status } });
  if (q.source?.length) and.push({ listings: { some: { sourceId: { in: q.source } } } });
  if (q.city) and.push({ OR: [{ cities: { has: q.city } }, { city: { contains: q.city, mode: 'insensitive' } }] });
  if (q.district) and.push({ OR: [{ district: { contains: q.district, mode: 'insensitive' } }, { listings: { some: { district: { contains: q.district, mode: 'insensitive' } } } }] });
  if (q.organizer) and.push({ organizer: { contains: q.organizer, mode: 'insensitive' } });
  if (q.q) {
    const n = normalizeArabic(q.q);
    and.push({ OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { normalizedTitle: { contains: n } }, { organizer: { contains: q.q, mode: 'insensitive' } }, { locationText: { contains: q.q, mode: 'insensitive' } }] });
  }
  const sf = date(q.startFrom), st = date(q.startTo), ef = date(q.endFrom), et = date(q.endTo);
  if (sf || st) and.push({ startAt: { ...(sf && { gte: sf }), ...(st && { lt: new Date(st.getTime() + (q.startTo!.length === 10 ? 86_400_000 : 0)) }) } });
  if (ef || et) and.push({ endAt: { ...(ef && { gte: ef }), ...(et && { lt: new Date(et.getTime() + (q.endTo!.length === 10 ? 86_400_000 : 0)) }) } });
  const min = q.minPrice ? Number(q.minPrice) : undefined, max = q.maxPrice ? Number(q.maxPrice) : undefined;
  if (min != null || max != null) {
    const range = { ...(min != null && isFinite(min) && { gte: min }), ...(max != null && isFinite(max) && { lte: max }) };
    and.push({ OR: [{ currentPrice: range }, { currentPrice: null, startPrice: range }] });
  }
  if (q.saved) and.push({ saved: { isNot: null } });
  if (q.endingToday) {
    const { start, end } = riyadhDayBounds();
    and.push({ status: { not: 'ended' }, endAt: { gte: new Date(Math.max(start.getTime(), Date.now())), lt: end } });
  }
  const ns = date(q.newSince);
  if (ns) and.push({ firstSeenAt: { gte: ns } });
  return { AND: and };
}

export function buildOrder(sort?: string): Prisma.AuctionOrderByWithRelationInput[] {
  switch (sort) {
    case 'ending': return [{ endAt: { sort: 'asc', nulls: 'last' } }];
    case 'starting': return [{ startAt: { sort: 'asc', nulls: 'last' } }];
    case 'price_desc': return [{ currentPrice: { sort: 'desc', nulls: 'last' } }, { startPrice: { sort: 'desc', nulls: 'last' } }];
    case 'price_asc': return [{ currentPrice: { sort: 'asc', nulls: 'last' } }, { startPrice: { sort: 'asc', nulls: 'last' } }];
    case 'newest':
    default: return [{ firstSeenAt: 'desc' }, { endAt: { sort: 'asc', nulls: 'last' } }];
  }
}

/**
 * Default view shows active auctions (live + upcoming). `status=all` shows everything incl. ended;
 * "starting soonest" defaults to upcoming only.
 */
export function defaultStatusFor(q: AuctionQuery): AuctionQuery {
  if (q.status?.includes('all')) return { ...q, status: undefined };
  if (q.saved && !q.status?.length) return q;
  if (!q.status?.length) return { ...q, status: q.sort === 'starting' ? ['upcoming'] : ['live', 'upcoming'] };
  return q;
}
