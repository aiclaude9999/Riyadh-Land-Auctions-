import { prisma } from '@/lib/db';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const sources = await prisma.source.findMany({
    orderBy: { id: 'asc' },
    include: { runs: { orderBy: { startedAt: 'desc' }, take: 15 }, _count: { select: { listings: true } } },
  });
  return json(sources);
});

/** PATCH {id, enabled} — enable/disable a source. */
export const PATCH = handle(async (req: Request) => {
  const { id, enabled } = await req.json();
  const s = await prisma.source.update({ where: { id: String(id) }, data: { enabled: !!enabled } });
  return json(s);
});
