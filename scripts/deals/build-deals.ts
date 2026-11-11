/**
 * Build src/data/riyadh-deals.json from Ministry of Justice quarterly sales CSV files.
 * Download the CSVs from open.data.gov.sa on a Saudi network (the portal is geo-blocked elsewhere), then:
 *   npx tsx scripts/deals/build-deals.ts 2026-Q2=path/q2.csv 2026-Q3=path/q3.csv ...
 * Only Riyadh-city districts are kept; the raw files are not committed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseMojCsv, summariseDeals, type DistrictPoint } from '../../src/lib/deals';

const args = process.argv.slice(2).map((a) => a.split('='));
if (!args.length || args.some((a) => a.length !== 2 || !/^\d{4}-Q[1-4]$/.test(a[0]))) {
  throw new Error('usage: build-deals.ts 2026-Q2=file.csv [2026-Q3=file.csv ...]');
}
const points = JSON.parse(readFileSync('src/data/riyadh-district-centroids.json', 'utf8')) as DistrictPoint[];
const quarters = args.map(([q, f]) => ({ q, rows: parseMojCsv(readFileSync(f, 'utf8')) })).sort((a, b) => a.q.localeCompare(b.q));
const data = summariseDeals(quarters, points);
writeFileSync('src/data/riyadh-deals.json', JSON.stringify(data) + '\n');
for (const q of data.quarters) console.log(`${q.q}: Riyadh city deals ${q.riyadhDeals}, on map ${q.mapped}`);
console.log(`districts (all quarters): ${data.rows.filter((r) => r.q === 'all').length}`);
