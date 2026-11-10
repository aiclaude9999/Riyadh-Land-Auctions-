import { prisma } from '@/lib/db';
import { geoWhere } from '@/lib/query';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const g = geoWhere(new URL(req.url).searchParams.get('geo') ?? undefined);
  const [cities, organizers, districts, sources] = await Promise.all([
    prisma.$queryRawUnsafe<{ v: string; n: bigint }[]>(`select unnest(cities) v, count(*) n from "Auction" group by 1 order by 2 desc limit 80`),
    prisma.auction.groupBy({ by: ['organizer'], where: { ...g, organizer: { not: null } }, _count: true, orderBy: { _count: { organizer: 'desc' } }, take: 80 }),
    prisma.listing.groupBy({ by: ['district'], where: { district: { not: null }, auction: g }, _count: true, orderBy: { _count: { district: 'desc' } }, take: 80 }),
    prisma.source.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
  ]);
  return json({
    cities: cities.map((c) => c.v),
    organizers: organizers.map((o) => o.organizer),
    districts: districts.map((d) => d.district),
    sources,
  });
});
