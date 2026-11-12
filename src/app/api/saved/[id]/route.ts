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

/** Save the owner's note / maximum bid / checklist for an auction (saves the auction too). */
export const PATCH = handle(async (r: Request, { params }: P) => {
  const { id } = await params;
  const b = await r.json().catch(() => ({}));
  const data: { note?: string | null; maxBid?: number | null; checklist?: string[] } = {};
  if ('note' in b) data.note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
  if ('maxBid' in b) { const n = Number(b.maxBid); data.maxBid = isFinite(n) && n > 0 ? n : null; }
  if (Array.isArray(b.checklist)) data.checklist = b.checklist.filter((x: unknown) => typeof x === 'string').slice(0, 30);
  const saved = await prisma.savedAuction.upsert({ where: { auctionId: id }, create: { auctionId: id, ...data }, update: data });
  return json({ saved });
});
