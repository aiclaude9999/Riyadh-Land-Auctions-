import { prisma } from '@/lib/db';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const unreadOnly = new URL(req.url).searchParams.get('unread') === '1';
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: unreadOnly ? { readAt: null } : {}, orderBy: { createdAt: 'desc' }, take: 100, include: { auction: { select: { id: true, title: true } } } }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);
  return json({ items, unread });
});

/** POST {ids?: string[]} — mark as read (all when ids omitted). */
export const POST = handle(async (req: Request) => {
  const { ids } = await req.json().catch(() => ({}));
  const r = await prisma.notification.updateMany({ where: { readAt: null, ...(Array.isArray(ids) ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  return json({ updated: r.count });
});
