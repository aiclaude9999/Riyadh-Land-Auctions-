/**
 * Location check for stored data. Default = READ-ONLY report of assets whose stored Riyadh scope differs from
 * the current rules (pin outside Riyadh city / outside Riyadh Province, title naming a town).
 * With --fix: updates those assets' geoScope and their auctions' geoScope/hasRiyadhCity/hasRiyadhRegion
 * (nothing else; no change-log events). Needs DATABASE_URL.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { classifyGeo, inRiyadhCityBox, inSaudi, type GeoScope } from '@/lib/geo';
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

  // WHY: auctions still marked Riyadh city although at least one of their plots has a pin outside the city
  const outIds = uniq(assets.filter((a) => inSaudi(a.latitude, a.longitude) && !inRiyadhCityBox(a.latitude, a.longitude) && a.listing.auction.geoScope === 'riyadh_city').map((a) => a.listing.auction.id));
  if (outIds.length) {
    console.log(`\nWHY still Riyadh city (لماذا ما زالت "مدينة الرياض"): ${outIds.length} auctions`);
    for (const id of outIds) {
      const au = await prisma.auction.findUnique({ where: { id }, select: { title: true, listings: { select: { sourceId: true, city: true, cities: true, region: true, assets: { select: { title: true, city: true, district: true, latitude: true, longitude: true, geoScope: true } } } } } });
      console.log(`  ■ ${au?.title}`);
      for (const l of au?.listings ?? []) {
        console.log(`     · ${l.sourceId}: city=${l.city ?? '-'} cities=[${l.cities.join(', ')}] region=${l.region ?? '-'} assets=${l.assets.length}`, count(l.assets, (x) => x.geoScope));
        for (const x of l.assets.filter((x) => x.geoScope === 'riyadh_city').slice(0, 3))
          console.log(`        riyadh_city plot: ${x.title} | city=${x.city ?? '-'} district=${x.district ?? '-'} pin=${x.latitude != null ? `${x.latitude.toFixed(3)},${x.longitude?.toFixed(3)}` : 'none'}`);
      }
    }
  }

  if (!FIX) { console.log('\nRead-only. Nothing was changed.\n'); await prisma.$disconnect(); return; }

  for (const { a, to } of changed) await prisma.asset.update({ where: { id: a.id }, data: { geoScope: to } });
  // also re-check every auction that has a plot pinned outside Riyadh city (catches labels left by older rules)
  const recheck = uniq([...auctionIds, ...assets.filter((a) => inSaudi(a.latitude, a.longitude) && !inRiyadhCityBox(a.latitude, a.longitude)).map((a) => a.listing.auction.id)]);
  const after: Record<string, number> = {};
  let auctionsChanged = 0;
  for (const id of recheck) {
    const listings = await prisma.listing.findMany({ where: { auctionId: id }, orderBy: { lastSuccessAt: 'desc' }, include: { assets: { select: { city: true, geoScope: true, propertyType: true, usage: true, areaSqm: true, startPrice: true, deposit: true } } } });
    if (!listings.length) continue;
    const m = auctionFieldsFrom(listings.map((l) => ({
      ...l, startPrice: numOrNull(l.startPrice), currentPrice: numOrNull(l.currentPrice), deposit: numOrNull(l.deposit),
      assetCities: uniq<string>(l.assets.map((x) => x.city)), geoScopes: l.assets.map((x) => x.geoScope as GeoScope),
      assetInfo: l.assets.map((x) => ({ propertyType: x.propertyType, usage: x.usage, areaSqm: x.areaSqm, startPrice: numOrNull(x.startPrice), deposit: numOrNull(x.deposit) })),
    })));
    const cur = await prisma.auction.findUnique({ where: { id }, select: { geoScope: true, hasRiyadhCity: true, hasRiyadhRegion: true } });
    if (cur && cur.geoScope === m.geoScope && cur.hasRiyadhCity === m.hasRiyadhCity && cur.hasRiyadhRegion === m.hasRiyadhRegion) continue;
    await prisma.auction.update({ where: { id }, data: { geoScope: m.geoScope, hasRiyadhCity: m.hasRiyadhCity, hasRiyadhRegion: m.hasRiyadhRegion } });
    after[m.geoScope] = (after[m.geoScope] ?? 0) + 1;
    auctionsChanged++;
  }
  console.log(`\nFIXED (تم التصحيح): ${changed.length} assets, ${auctionsChanged} auctions → now`, after, '\n');
  await prisma.$disconnect();
})();
