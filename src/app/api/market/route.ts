import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { median } from '@/lib/deals';
import { assetInsights } from '@/lib/insights';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';
const num = (v: unknown) => (v == null ? null : Number(v));
const auctionSel = { id: true, title: true, status: true, startAt: true, endAt: true } as const;

/**
 * Market knowledge:
 *   ?section=results   ended auctions: final price (sold price when published, else last shown price)
 *   ?section=relisted  same title deed offered in more than one auction
 *   ?section=platforms per-platform counts and medians (active auctions)
 * &geo=riyadh_city|riyadh_region|all  &type=land|all
 */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const section = sp.get('section') ?? 'results';
  const geo = sp.get('geo') ?? 'riyadh_city';
  const type = sp.get('type') ?? 'land';
  const geoWhere: Prisma.AssetWhereInput = geo === 'riyadh_city' ? { geoScope: 'riyadh_city' } : geo === 'riyadh_region' ? { geoScope: { in: ['riyadh_city', 'riyadh_region'] } } : {};
  const typeWhere: Prisma.AssetWhereInput = type === 'land' ? { propertyType: 'land' } : {};

  if (section === 'results') {
    const rows = await prisma.asset.findMany({
      where: { ...geoWhere, ...typeWhere, listing: { auction: { status: 'ended', category: 'real_estate' } }, OR: [{ soldPrice: { not: null } }, { currentPrice: { not: null } }] },
      orderBy: { listing: { auction: { endAt: { sort: 'desc', nulls: 'last' } } } },
      take: 300,
      include: { listing: { select: { url: true, source: { select: { name: true } }, auction: { select: auctionSel } } } },
    });
    return json({
      items: rows.map((x) => {
        const sold = num(x.soldPrice), last = num(x.currentPrice);
        const price = sold ?? last;
        return { ...x, finalPrice: price, priceKind: sold != null ? 'sold' : 'last', ppm: price && x.areaSqm ? Math.round(price / x.areaSqm) : null,
          insights: assetInsights({ ...x, startPrice: null, currentPrice: price }) };
      }),
    });
  }

  if (section === 'relisted') {
    const groups = await prisma.asset.groupBy({ by: ['deedNumber'], where: { deedNumber: { not: null }, ...geoWhere }, _count: { _all: true }, having: { deedNumber: { _count: { gt: 1 } } }, orderBy: { deedNumber: 'asc' }, take: 300 });
    const deeds = groups.map((g) => g.deedNumber!).filter(Boolean);
    const rows = deeds.length ? await prisma.asset.findMany({
      where: { deedNumber: { in: deeds } },
      include: { listing: { select: { url: true, auctionId: true, source: { select: { name: true } }, auction: { select: auctionSel } } } },
    }) : [];
    const byDeed = new Map<string, typeof rows>();
    rows.forEach((r) => byDeed.set(r.deedNumber!, [...(byDeed.get(r.deedNumber!) ?? []), r]));
    const items = [...byDeed.entries()]
      .map(([deed, list]) => ({ deed, list: list.sort((a, b) => +new Date(a.listing.auction.startAt ?? 0) - +new Date(b.listing.auction.startAt ?? 0)) }))
      .filter((g) => new Set(g.list.map((x) => x.listing.auctionId)).size > 1) // same deed on two platforms of ONE auction is not a re-listing
      .sort((a, b) => +new Date(b.list.at(-1)!.listing.auction.startAt ?? 0) - +new Date(a.list.at(-1)!.listing.auction.startAt ?? 0));
    return json({ items });
  }

  // platforms
  const [sources, assets] = await Promise.all([
    prisma.source.findMany({ select: { id: true, name: true, status: true, lastSuccessAt: true } }),
    prisma.asset.findMany({
      where: { listing: { auction: { status: { in: ['live', 'upcoming'] }, category: 'real_estate' } } },
      select: { propertyType: true, geoScope: true, areaSqm: true, startPrice: true, currentPrice: true, deposit: true, listing: { select: { sourceId: true, auctionId: true } } },
      take: 20000,
    }),
  ]);
  const items = sources.map((s) => {
    const mine = assets.filter((a) => a.listing.sourceId === s.id);
    const riyadhLand = mine.filter((a) => a.geoScope === 'riyadh_city' && a.propertyType === 'land');
    const ppm = riyadhLand.map((a) => { const p = num(a.currentPrice) ?? num(a.startPrice); return p && a.areaSqm ? p / a.areaSqm : null; }).filter((x): x is number => x != null && x > 20);
    return {
      id: s.id, name: s.name, status: s.status, lastSuccessAt: s.lastSuccessAt,
      auctions: new Set(mine.map((a) => a.listing.auctionId)).size,
      assets: mine.length,
      riyadhLand: riyadhLand.length,
      riyadhLandPriced: ppm.length,
      medianLandPpm: median(ppm),
      medianDeposit: median(mine.map((a) => num(a.deposit)).filter((x): x is number => x != null)),
    };
  }).sort((a, b) => b.assets - a.assets);
  return json({ items });
});
