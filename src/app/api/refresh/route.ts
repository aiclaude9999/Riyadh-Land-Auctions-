import { prisma } from '@/lib/db';
import { schedulerMode, triggerGithubCollect } from '@/lib/scheduler-mode';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

/** POST {sourceId?} — manual "تحديث الآن". Worker mode: queue jobs. Free mode: start the GitHub collector. */
export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const ids = body?.sourceId
    ? [String(body.sourceId)]
    : (await prisma.source.findMany({ where: { enabled: true }, select: { id: true } })).map((s) => s.id);
  if (schedulerMode() === 'github') {
    try {
      await triggerGithubCollect();
    } catch (e: any) {
      return json({ error: e.message }, { status: 400 });
    }
    return json({ queued: ids, via: 'github', note: 'بدأ التحديث على GitHub — النتائج خلال 2–3 دقائق' });
  }
  const { enqueueScrape } = await import('@/lib/queue'); // Redis only needed in worker mode
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('لا يمكن الوصول إلى Redis — تأكد من تشغيله وتشغيل الـ worker')), 5000));
  try {
    await Promise.race([Promise.all(ids.map((id) => enqueueScrape(id, 'manual'))), timeout]);
  } catch (e: any) {
    return json({ error: e.message }, { status: 503 });
  }
  return json({ queued: ids, via: 'worker' });
});
