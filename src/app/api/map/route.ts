import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

/**
 * Assets that have map coordinates, for the map page (compact rows).
 * GET /api/map?geo=riyadh_city|riyadh_region|all&status=live,upcoming|all&category=real_estate|all
 */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const geo = sp.get('geo') ?? 'riyadh_city';
  const statusParam = sp.get('status');
  const statuses = statusParam === 'all' ? undefined : statusParam?.split(',').filter(Boolean) ?? ['live', 'upcoming'];
  const category = sp.get('category') ?? 'real_estate';
  const auction: Prisma.AuctionWhereInput = {
    ...(statuses && { status: { in: statuses } }),
    ...(category !== 'all' && { category }),
  };
  const where: Prisma.AssetWhereInput = {
    latitude: { not: null }, longitude: { not: null },
    listing: { auction },
    ...(geo === 'riyadh_city' && { geoScope: 'riyadh_city' }),
    ...(geo === 'riyadh_region' && { geoScope: { in: ['riyadh_city', 'riyadh_region'] } }),
  };
  const rows = await prisma.asset.findMany({
    where, take: 3000,
    select: {
      id: true, title: true, propertyType: true, usage: true, areaSqm: true, startPrice: true, currentPrice: true, deposit: true,
      city: true, district: true, latitude: true, longitude: true,
      listing: { select: { sourceId: true, url: true, auction: { select: { id: true, title: true, status: true, startAt: true, endAt: true } } } },
    },
  });
  // compact payload: [lat, lng, ...]
  return json(rows.map((r) => ({
    id: r.id, lat: r.latitude, lng: r.longitude, t: r.title, pt: r.propertyType, u: r.usage, ar: r.areaSqm,
    p: r.currentPrice ?? r.startPrice, cur: r.currentPrice != null, dp: r.deposit, ci: r.city, d: r.district,
    src: r.listing.sourceId, url: r.listing.url, a: r.listing.auction,
  })));
});
