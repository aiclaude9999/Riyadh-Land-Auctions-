import { prisma } from '@/lib/db';
import { handle, json } from '../_util';
import { assetInsights } from '@/lib/insights';

export const dynamic = 'force-dynamic';

/**
 * Riyadh land plots (ongoing/upcoming) compared with their district's median land price.
 * GET /api/good-deals?status=live,upcoming|all&verdict=below|all
 */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const statusParam = sp.get('status');
  const statuses = statusParam === 'all' ? undefined : statusParam?.split(',').filter(Boolean) ?? ['live', 'upcoming'];
  const rows = await prisma.asset.findMany({
    where: {
      geoScope: 'riyadh_city', propertyType: 'land', areaSqm: { gt: 0 },
      OR: [{ startPrice: { not: null } }, { currentPrice: { not: null } }],
      listing: { auction: { category: 'real_estate', ...(statuses && { status: { in: statuses } }) } },
    },
    take: 2000,
    include: { listing: { select: { url: true, sourceId: true, source: { select: { name: true } }, auction: { select: { id: true, title: true, status: true, startAt: true, endAt: true } } } } },
  });
  const items = rows
    .map((x) => ({ ...x, insights: assetInsights({ ...x, startPrice: x.startPrice == null ? null : Number(x.startPrice), currentPrice: x.currentPrice == null ? null : Number(x.currentPrice) }) }))
    .filter((x) => x.insights?.diffPct != null && (sp.get('verdict') === 'all' || x.insights.verdict === 'below'))
    .sort((a, b) => a.insights!.diffPct! - b.insights!.diffPct!);
  return json({ total: items.length, items });
});
