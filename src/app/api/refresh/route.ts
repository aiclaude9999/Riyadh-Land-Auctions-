import { prisma } from '@/lib/db';
import { enqueueScrape } from '@/lib/queue';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

/** POST {sourceId?} — manual "تحديث الآن". Jobs go through the same queue (deduplicated per source). */
export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const ids = body?.sourceId
    ? [String(body.sourceId)]
    : (await prisma.source.findMany({ where: { enabled: true }, select: { id: true } })).map((s) => s.id);
  await Promise.all(ids.map((id) => enqueueScrape(id, 'manual')));
  return json({ queued: ids });
});
