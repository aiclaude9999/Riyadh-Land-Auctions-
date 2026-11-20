/**
 * Builds data/riyadh-districts.json (189 Riyadh-city neighbourhoods: Arabic + English name,
 * centre point, simplified boundary) from the repo's district files (../src/data/riyadh-district-*.json).
 * Origin: homaily/Saudi-Arabia-Regions-Cities-and-Districts (GPL-2.0), collected from the
 * Saudi Post address map (maps.address.gov.sa). Credit is shown in the app.
 *   npm run build:districts
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Centroid = { name: string; nameEn: string; lat: number; lng: number };
type Shape = { name: string; rings: [number, number][][] };

const centroids = JSON.parse(readFileSync('../src/data/riyadh-district-centroids.json', 'utf8')) as Centroid[];
const shapes = new Map((JSON.parse(readFileSync('../src/data/riyadh-district-shapes.json', 'utf8')) as Shape[]).map((s) => [s.name, s.rings]));

const districts = centroids.map((c, i) => ({
  id: `d${i + 1}`,
  name_ar: c.name,
  name_en: c.nameEn,
  center: { lat: c.lat, lng: c.lng },
  rings: shapes.get(c.name) ?? [],
}));
const out = { source: 'Saudi Post address map via github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts', license: 'GPL-2.0', districts };
writeFileSync('data/riyadh-districts.json', JSON.stringify(out) + '\n');
console.log(`${districts.length} districts, ${districts.filter((d) => !d.rings.length).length} without boundary`);
