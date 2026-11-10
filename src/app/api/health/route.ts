import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Health check for the hosting platform: the app is up and the database answers. */
export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 503 });
  }
}
