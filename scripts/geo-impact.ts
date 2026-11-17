/**
 * Location check for stored data. Default = READ-ONLY report of assets whose stored Riyadh scope differs from
 * the current rules (pin outside Riyadh city / outside Riyadh Province, title naming a town).
 * With --fix: updates those assets' geoScope and their auctions' geoScope/hasRiyadhCity/hasRiyadhRegion
 * (nothing else; no change-log events). Needs DATABASE_URL.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { classifyGeo, type GeoScope } from '@/lib/geo';
import { auctionFieldsFrom } from '@/lib/ingest';
import { uniq } from '@/lib/normalize';

const FIX = process.argv.includes('--fix');
const numOrNull = (d: Prisma.Decimal | null) => (d == null ? null : Number(d));

(async () => {
  const assets = await prisma.asset.findMany({
    select: { id: true, title: true, city: true, region: true, district: true, latitude: true, longitude: true, geoScope: true, propertyType: true,
      listing: { select: { sourceId: true, auction: { select: { id: true, title: true, geoScope: true, status: true } } } } },
  });
  const changed = assets
    .map((a) => ({ a, to: classifyGeo({ cities: [a.city], regions: [a.region], districts: [a.district], lat: a.latitude, lng: a.longitude, text: a.title }).scope }))
    .filter(({ a, to }) => to !== a.geoScope);
  const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});

  console.log('');
  console.log(`Assets checked (كل الأصول): ${assets.length}`);
  console.log(`Assets to correct (أصول تحتاج تصحيح): ${changed.length}  — of which land (منها أراضٍ): ${changed.filter((c) => c.a.propertyType === 'land').length}`);
  console.log('  from → to:', count(changed, (c) => `${c.a.geoScope} → ${c.to}`));
  console.log('  by source (حسب المنصة):', count(changed, (c) => c.a.listing.sourceId));
  const auctionIds = uniq(changed.map((c) => c.a.listing.auction.id));
  console.log(`Auctions involved (مزادات): ${auctionIds.length}`);
  for (const id of auctionIds) { const au = changed.find((c) => c.a.listing.auction.id === id)!.a.listing.auction; console.log(`  - ${au.title}  [${au.status}, now: ${au.geoScope}]`); }

  if (!FIX) { console.log('\nRead-only. Nothing was changed.\n'); await prisma.$disconnect(); return; }

  for (const { a, to } of changed) await prisma.asset.update({ where: { id: a.id }, data: { geoScope: to } });
  const after: Record<string, number> = {};
  for (const id of auctionIds) {
    const listings = await prisma.listing.findMany({ where: { auctionId: id }, orderBy: { lastSuccessAt: 'desc' }, include: { assets: { select: { city: true, geoScope: true, propertyType: true, usage: true, areaSqm: true, startPrice: true, deposit: true } } } });
    if (!listings.length) continue;
    const m = auctionFieldsFrom(listings.map((l) => ({
      ...l, startPrice: numOrNull(l.startPrice), currentPrice: numOrNull(l.currentPrice), deposit: numOrNull(l.deposit),
      assetCities: uniq<string>(l.assets.map((x) => x.city)), geoScopes: l.assets.map((x) => x.geoScope as GeoScope),
      assetInfo: l.assets.map((x) => ({ propertyType: x.propertyType, usage: x.usage, areaSqm: x.areaSqm, startPrice: numOrNull(x.startPrice), deposit: numOrNull(x.deposit) })),
    })));
    await prisma.auction.update({ where: { id }, data: { geoScope: m.geoScope, hasRiyadhCity: m.hasRiyadhCity, hasRiyadhRegion: m.hasRiyadhRegion } });
    after[m.geoScope] = (after[m.geoScope] ?? 0) + 1;
  }
  console.log(`\nFIXED (تم التصحيح): ${changed.length} assets, ${auctionIds.length} auctions → now`, after, '\n');
  await prisma.$disconnect();
})();
