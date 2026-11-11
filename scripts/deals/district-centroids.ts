/**
 * Build src/data/riyadh-district-centroids.json (one point per Riyadh-city district).
 *
 * Input: json/districts.json from https://github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts
 * (district boundaries collected from the Saudi Post address map, maps.address.gov.sa).
 *   npx tsx scripts/deals/district-centroids.ts /path/to/districts.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ringCentroid } from '../../src/lib/deals';

const RIYADH_CITY_ID = 3;
const file = process.argv[2];
if (!file) throw new Error('usage: district-centroids.ts <districts.json>');
const all = JSON.parse(readFileSync(file, 'utf8')) as { city_id: number; name_ar: string; name_en: string; boundaries: [number, number][][] }[];
const points = all
  .filter((d) => d.city_id === RIYADH_CITY_ID)
  .map((d) => {
    // several polygons: use the biggest one
    const best = d.boundaries.map(ringCentroid).sort((a, b) => b.area - a.area)[0];
    return { name: d.name_ar.trim(), nameEn: d.name_en.trim(), lat: +best.lat.toFixed(5), lng: +best.lng.toFixed(5) };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
writeFileSync('src/data/riyadh-district-centroids.json', JSON.stringify(points, null, 1) + '\n');
console.log(`wrote ${points.length} Riyadh districts`);
