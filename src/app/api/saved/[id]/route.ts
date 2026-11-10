import { prisma } from '@/lib/db';
import { handle, json } from '../../_util';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export const POST = handle(async (_r: Request, { params }: P) => {
  const { id } = await params;
  await prisma.savedAuction.upsert({ where: { auctionId: id }, create: { auctionId: id }, update: {} });
  return json({ saved: true });
});
export const DELETE = handle(async (_r: Request, { params }: P) => {
  const { id } = await params;
  await prisma.savedAuction.deleteMany({ where: { auctionId: id } });
  return json({ saved: false });
});
