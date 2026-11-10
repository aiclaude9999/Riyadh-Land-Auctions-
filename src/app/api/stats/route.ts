import { prisma } from '@/lib/db';
import { focusWhere, geoWhere } from '@/lib/query';
import { riyadhDayBounds } from '@/lib/time';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const g = { ...geoWhere(sp.get('geo') ?? undefined), ...focusWhere(sp.get('focus') ?? undefined) };
  const now = new Date();
  const { end } = riyadhDayBounds(now);
  const [total, live, upcoming, endingToday, new24h, lastRun, sources] = await Promise.all([
    prisma.auction.count({ where: { ...g, status: { not: 'ended' } } }),
    prisma.auction.count({ where: { ...g, status: 'live' } }),
    prisma.auction.count({ where: { ...g, status: 'upcoming' } }),
    prisma.auction.count({ where: { ...g, status: { not: 'ended' }, endAt: { gte: now, lt: end } } }),
    prisma.auction.count({ where: { ...g, status: { not: 'ended' }, firstSeenAt: { gte: new Date(now.getTime() - 86_400_000) } } }),
    prisma.source.aggregate({ _max: { lastSuccessAt: true } }),
    prisma.source.findMany({ select: { id: true, name: true, status: true, lastSuccessAt: true, lastError: true, enabled: true }, orderBy: { id: 'asc' } }),
  ]);
  return json({ total, live, upcoming, endingToday, new24h, lastUpdate: lastRun._max.lastSuccessAt, sources });
});
