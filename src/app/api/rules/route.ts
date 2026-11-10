import { prisma } from '@/lib/db';
import { ensureDefaultRules } from '@/lib/notify';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await ensureDefaultRules();
  return json(await prisma.notificationRule.findMany({ orderBy: { createdAt: 'asc' } }));
});

/** PUT {id, enabled?, params?, channels?} */
export const PUT = handle(async (req: Request) => {
  const b = await req.json();
  const channels = Array.isArray(b.channels) ? b.channels.filter((c: string) => ['in_app', 'telegram'].includes(c)) : undefined;
  const r = await prisma.notificationRule.update({
    where: { id: String(b.id) },
    data: { ...(b.enabled != null && { enabled: !!b.enabled }), ...(b.params && { params: b.params }), ...(channels && { channels: channels.includes('in_app') ? channels : ['in_app', ...channels] }) },
  });
  return json(r);
});
