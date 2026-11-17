/**
 * READ-ONLY report: how many assets/auctions are (or were) wrongly placed in Riyadh city although their
 * map pin is elsewhere. Changes nothing. Run: npx tsx scripts/geo-impact.ts (needs DATABASE_URL).
 */
import { prisma } from '@/lib/db';
import { classifyGeo, inRiyadhCityBox, inSaudi, isRiyadhCity } from '@/lib/geo';

(async () => {
  const assets = await prisma.asset.findMany({
    select: { id: true, title: true, city: true, region: true, district: true, latitude: true, longitude: true, geoScope: true, propertyType: true,
      listing: { select: { sourceId: true, auction: { select: { id: true, title: true, geoScope: true, status: true } } } } },
  });
  const stillWrong = assets.filter((a) => a.geoScope === 'riyadh_city' && classifyGeo({ cities: [a.city], regions: [a.region], districts: [a.district], lat: a.latitude, lng: a.longitude, text: a.title }).scope !== 'riyadh_city');
  const alreadyFixed = assets.filter((a) => a.geoScope !== 'riyadh_city' && isRiyadhCity(a.city) && inSaudi(a.latitude, a.longitude) && !inRiyadhCityBox(a.latitude, a.longitude));
  const all = [...stillWrong, ...alreadyFixed];
  const by = (xs: typeof all, f: (a: (typeof all)[number]) => string) => xs.reduce<Record<string, number>>((m, a) => ((m[f(a)] = (m[f(a)] ?? 0) + 1), m), {});
  const auctions = new Map(all.map((a) => [a.listing.auction.id, a.listing.auction]));

  console.log('');
  console.log(`Assets checked (كل الأصول): ${assets.length}`);
  console.log(`Affected assets (أصول متأثرة): ${all.length}  — still wrong (لم تُصحح بعد): ${stillWrong.length}, already fixed (صُححت): ${alreadyFixed.length}`);
  console.log(`  of which land (منها أراضٍ): ${all.filter((a) => a.propertyType === 'land').length}`);
  console.log(`  by source (حسب المنصة):`, by(all, (a) => a.listing.sourceId));
  console.log(`Affected auctions (مزادات متأثرة): ${auctions.size}`);
  for (const au of auctions.values()) console.log(`  - ${au.title}  [${au.status}, now: ${au.geoScope}]`);
  console.log('');
  await prisma.$disconnect();
})();
