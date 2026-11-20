/**
 * Builds data/venues-riyadh.json: every named café/restaurant in Riyadh from OpenStreetMap (ODbL).
 * Used by the free mode (no Google key). Downloaded once, so searches never hit Overpass —
 * the public Overpass servers are often at capacity and ask apps not to query them on every request.
 *
 *   npm run build:venues                      # tries several Overpass servers
 *   npm run build:venues -- --from saved.json # convert an Overpass JSON you saved yourself
 * (in the cloud sandbox add NODE_USE_ENV_PROXY=1)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { RIYADH_BOUNDS as B } from '../lib/geo';
import { parseOverpass } from '../lib/venues';

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const QUERY = `[out:json][timeout:180];nwr["amenity"~"^(cafe|restaurant)$"]["name"](${B.south},${B.west},${B.north},${B.east});out center tags;`;

async function download(): Promise<unknown> {
  for (const url of SERVERS) {
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(QUERY)}`, { headers: { 'User-Agent': 'riyadh-meetup-point-prototype/0.1' } });
      if (res.ok) return await res.json();
      console.warn(`${url}: HTTP ${res.status}`);
    } catch (e) {
      console.warn(`${url}: ${(e as Error).message}`);
    }
  }
  throw new Error('All Overpass servers failed — try again later, or save the query result in a browser and use --from');
}

async function main() {
  const i = process.argv.indexOf('--from');
  const json = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], 'utf8')) : await download();
  const venues = parseOverpass(json as { elements: [] }).sort((a, b) => a.id.localeCompare(b.id));
  const osmTimestamp = (json as { osm3s?: { timestamp_osm_base?: string } }).osm3s?.timestamp_osm_base;
  const out = { source: '© OpenStreetMap contributors', license: 'ODbL-1.0', generatedAt: new Date().toISOString(), osmTimestamp, venues };
  writeFileSync('data/venues-riyadh.json', JSON.stringify(out) + '\n');
  console.log(`${venues.length} venues (${venues.filter((v) => v.kind === 'cafe').length} cafés)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
