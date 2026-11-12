import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { handle, json } from '../_util';
import { assetInsights } from '@/lib/insights';

export const dynamic = 'force-dynamic';
const dnum = (v: unknown) => (v == null ? null : Number(v));

/**
 * Individual real-estate assets (land plots, villas, buildings…) across all auctions.
 * GET /api/assets?geo=&propertyType=&usage=&status=&district=&q=&minArea=&maxArea=&minPrice=&maxPrice=&source=&sort=&page=&pageSize=
 */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const list = (k: string) => sp.get(k)?.split(',').filter(Boolean);
  const num = (k: string) => { const v = sp.get(k); const n = v ? Number(v) : NaN; return isFinite(n) ? n : undefined; };
  const range = (min?: number, max?: number) => (min == null && max == null ? undefined : { ...(min != null && { gte: min }), ...(max != null && { lte: max }) });

  const geo = sp.get('geo') ?? 'riyadh_city';
  const scopes = geo === 'riyadh_region' ? ['riyadh_city', 'riyadh_region'] : ['riyadh_city'];
  const auctionGeo = geo === 'riyadh_region' ? { hasRiyadhRegion: true } : { hasRiyadhCity: true };
  const statuses = list('status')?.includes('all') ? undefined : list('status') ?? ['live', 'upcoming'];

  const ids = list('ids');
  if (ids?.length) {
    const items = await prisma.asset.findMany({
      where: { id: { in: ids.slice(0, 6) } },
      include: { listing: { select: { sourceId: true, url: true, source: { select: { name: true } }, auction: { select: { id: true, title: true, status: true, startAt: true, endAt: true, organizer: true } } } } },
    });
    return json({ total: items.length, page: 1, pageSize: items.length, byType: {}, items: items.map((x) => ({ ...x, insights: assetInsights({ ...x, startPrice: dnum(x.startPrice), currentPrice: dnum(x.currentPrice) }) })) });
  }
  const and: Prisma.AssetWhereInput[] = [
    { listing: { auction: { category: 'real_estate', ...(statuses && { status: { in: statuses } }) } } },
  ];
  // location of the asset itself; if the asset has no location, fall back to its auction's
  if (geo !== 'all') and.push({ OR: [{ geoScope: { in: scopes } }, { geoScope: 'unknown', listing: { auction: auctionGeo } }] });
  const types = list('propertyType');
  if (types?.length) and.push({ propertyType: { in: types } });
  const usages = list('usage');
  if (usages?.length) and.push({ usage: { in: usages } });
  const sources = list('source');
  if (sources?.length) and.push({ listing: { sourceId: { in: sources } } });
  const area = range(num('minArea'), num('maxArea'));
  if (area) and.push({ areaSqm: area });
  const price = range(num('minPrice'), num('maxPrice'));
  if (price) and.push({ OR: [{ currentPrice: price }, { currentPrice: null, startPrice: price }] });
  const district = sp.get('district');
  if (district) and.push({ OR: [{ district: { contains: district, mode: 'insensitive' } }, { title: { contains: district, mode: 'insensitive' } }] });
  const q = sp.get('q');
  if (q) and.push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { listing: { auction: { title: { contains: q, mode: 'insensitive' } } } }, { listing: { auction: { organizer: { contains: q, mode: 'insensitive' } } } }] });

  const sort = sp.get('sort') ?? 'ending';
  const orderBy: Prisma.AssetOrderByWithRelationInput[] =
    sort === 'price_asc' ? [{ startPrice: { sort: 'asc', nulls: 'last' } }]
    : sort === 'price_desc' ? [{ startPrice: { sort: 'desc', nulls: 'last' } }]
    : sort === 'area_desc' ? [{ areaSqm: { sort: 'desc', nulls: 'last' } }]
    : sort === 'area_asc' ? [{ areaSqm: { sort: 'asc', nulls: 'last' } }]
    : sort === 'newest' ? [{ listing: { auction: { firstSeenAt: 'desc' } } }]
    : [{ listing: { auction: { endAt: { sort: 'asc', nulls: 'last' } } } }];

  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? 30) || 30));
  const where = { AND: and };
  const [total, items, byType] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
      include: { listing: { select: { sourceId: true, url: true, source: { select: { name: true } }, auction: { select: { id: true, title: true, status: true, startAt: true, endAt: true, organizer: true } } } } },
    }),
    prisma.asset.groupBy({ by: ['propertyType'], where, _count: true }),
  ]);
  const withInsights = items.map((x) => ({ ...x, insights: assetInsights({ ...x, startPrice: dnum(x.startPrice), currentPrice: dnum(x.currentPrice) }) }));
  return json({ total, page, pageSize, items: withInsights, byType: Object.fromEntries(byType.map((b) => [b.propertyType ?? 'unknown', b._count])) });
});
