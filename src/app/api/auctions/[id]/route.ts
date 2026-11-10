import { prisma } from '@/lib/db';
import { handle, json } from '../../_util';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const a = await prisma.auction.findUnique({
    where: { id },
    include: {
      listings: { include: { assets: true, source: { select: { name: true } } }, orderBy: { lastSuccessAt: 'desc' } },
      changes: { orderBy: { at: 'desc' }, take: 50 },
      saved: true,
    },
  });
  if (!a) return json({ error: 'not found' }, { status: 404 });
  // never expose raw payloads to the browser
  a.listings.forEach((l: any) => delete l.raw);
  return json(a);
});
