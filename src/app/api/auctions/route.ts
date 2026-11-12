import { prisma } from '@/lib/db';
import { buildOrder, buildWhere, defaultStatusFor, parseQuery } from '@/lib/query';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const q = defaultStatusFor(parseQuery(new URL(req.url).searchParams));
  const where = buildWhere(q);
  const [total, items] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where, orderBy: buildOrder(q.sort), skip: (q.page! - 1) * q.pageSize!, take: q.pageSize,
      include: { listings: { select: { sourceId: true, url: true } }, saved: { select: { id: true, note: true, maxBid: true, checklist: true } } },
    }),
  ]);
  return json({ total, page: q.page, pageSize: q.pageSize, items });
});
