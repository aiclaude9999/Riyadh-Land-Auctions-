/**
 * Build the Riyadh-city district files used by the map's deals layer:
 *   src/data/riyadh-district-centroids.json — one point per district (used to place deals)
 *   src/data/riyadh-district-shapes.json    — simplified district boundaries (coloured by price on the map)
 *
 * Input: json/districts.json from https://github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts
 * (district boundaries collected from the Saudi Post address map, maps.address.gov.sa).
 *   npx tsx scripts/deals/district-centroids.ts /path/to/districts.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ringCentroid, simplifyRing } from '../../src/lib/deals';

const RIYADH_CITY_ID = 3;
const TOLERANCE = 0.0002; // degrees, ≈ 20 m
const file = process.argv[2];
if (!file) throw new Error('usage: district-centroids.ts <districts.json>');
const all = JSON.parse(readFileSync(file, 'utf8')) as { city_id: number; name_ar: string; name_en: string; boundaries: [number, number][][] }[];
const districts = all.filter((d) => d.city_id === RIYADH_CITY_ID).sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
const r5 = (x: number) => +x.toFixed(5);

const points = districts.map((d) => {
  const best = d.boundaries.map(ringCentroid).sort((a, b) => b.area - a.area)[0]; // biggest polygon
  return { name: d.name_ar.trim(), nameEn: d.name_en.trim(), lat: r5(best.lat), lng: r5(best.lng) };
});
const shapes = districts.map((d) => ({
  name: d.name_ar.trim(),
  rings: d.boundaries.map((r) => simplifyRing(r, TOLERANCE).map(([la, ln]) => [r5(la), r5(ln)])),
}));
writeFileSync('src/data/riyadh-district-centroids.json', JSON.stringify(points, null, 1) + '\n');
writeFileSync('src/data/riyadh-district-shapes.json', JSON.stringify(shapes) + '\n');
console.log(`wrote ${points.length} Riyadh districts, ${shapes.reduce((s, x) => s + x.rings.reduce((t, r) => t + r.length, 0), 0)} boundary points`);
