import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

/**
 * Auctions that open or close in one month (Riyadh time), for the calendar page.
 * GET /api/calendar?month=2026-12&geo=riyadh_city|riyadh_region|all&category=real_estate|all
 */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const m = /^(\d{4})-(\d{2})$/.exec(sp.get('month') ?? '');
  const now = new Date();
  const y = m ? Number(m[1]) : now.getUTCFullYear();
  const mo = m ? Number(m[2]) - 1 : now.getUTCMonth();
  // Riyadh is UTC+3 all year
  const from = new Date(Date.UTC(y, mo, 1) - 3 * 3600_000);
  const to = new Date(Date.UTC(y, mo + 1, 1) - 3 * 3600_000);
  const geo = sp.get('geo') ?? 'riyadh_city';
  const category = sp.get('category') ?? 'real_estate';
  const where: Prisma.AuctionWhereInput = {
    OR: [{ startAt: { gte: from, lt: to } }, { endAt: { gte: from, lt: to } }],
    ...(category !== 'all' && { category }),
    ...(geo === 'riyadh_city' && { hasRiyadhCity: true }),
    ...(geo === 'riyadh_region' && { hasRiyadhRegion: true }),
  };
  const items = await prisma.auction.findMany({
    where, take: 1500, orderBy: { startAt: 'asc' },
    select: { id: true, title: true, status: true, startAt: true, endAt: true, hasLand: true, landCount: true, assetCount: true, saved: { select: { id: true } } },
  });
  return json({ month: `${y}-${String(mo + 1).padStart(2, '0')}`, items });
});
