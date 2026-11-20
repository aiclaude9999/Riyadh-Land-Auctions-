/**
 * Builds data/venues-riyadh.json: every named café/restaurant in Riyadh from OpenStreetMap (ODbL).
 * Used by the free mode (no Google key). Downloaded once, so searches never hit Overpass —
 * the public Overpass servers are often at capacity and ask apps not to query them on every request.
 *
 *   npm run build:venues                                   # OSM only (tries several Overpass servers)
 *   npm run build:venues -- --from osm.json --overture data/overture-riyadh.json
 * Overture file: venv/bin/python scripts/overture/extract_riyadh.py <release> <out.json>
 * (in the cloud sandbox add NODE_USE_ENV_PROXY=1)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { RIYADH_BOUNDS as B } from '../lib/geo';
import { parseOverpass } from '../lib/venues';
import { dedupeSelf, mergeVenues, type SourcedVenue } from '../lib/venueMerge';

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

interface OvertureFile {
  release: string;
  venues: { id: string; name: string; nameAr?: string; kind: 'cafe' | 'restaurant'; lat: number; lng: number; cuisine?: string; address?: string; brand?: string; confidence: number }[];
}

/**
 * Sources (all optional, combined without duplicates):
 *   --from <overpass.json>       OSM cafés/restaurants (default: download)  — repeatable
 *   --overture <file.json>       made by scripts/overture/extract_riyadh.py
 */
async function main() {
  const args = process.argv.slice(2);
  const all = (flag: string) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
  const osmFiles = all('--from');
  const osmJsons = osmFiles.length ? osmFiles.map((f) => JSON.parse(readFileSync(f, 'utf8'))) : [await download()];
  const osm: SourcedVenue[] = dedupeSelf(osmJsons.flatMap((j) => parseOverpass(j as { elements: [] })).map((v) => ({ ...v, sources: ['osm'] })));
  const osmTimestamp = (osmJsons[0] as { osm3s?: { timestamp_osm_base?: string } }).osm3s?.timestamp_osm_base;

  let venues = osm;
  let overtureRelease: string | undefined;
  for (const f of all('--overture')) {
    const o = JSON.parse(readFileSync(f, 'utf8')) as OvertureFile;
    overtureRelease = o.release;
    const ovt: SourcedVenue[] = o.venues.map((v) => ({
      id: v.id,
      name: v.name,
      ...(v.nameAr ? { nameAr: v.nameAr } : {}),
      kind: v.kind,
      location: { lat: v.lat, lng: v.lng },
      ...(v.cuisine ? { cuisine: v.cuisine } : {}),
      ...(v.address ? { address: v.address } : {}),
      ...(v.brand ? { brand: v.brand } : {}),
      confidence: v.confidence,
      sources: ['overture'],
    }));
    venues = mergeVenues(venues, dedupeSelf(ovt));
  }
  venues.sort((a, b) => a.id.localeCompare(b.id));
  const count = (s: string) => venues.filter((v) => v.sources.includes(s)).length;
  const out = {
    sources: ['© OpenStreetMap contributors (ODbL)', ...(overtureRelease ? ['© Overture Maps Foundation (CDLA-Permissive-2.0)'] : [])],
    generatedAt: new Date().toISOString(),
    osmTimestamp,
    overtureRelease,
    counts: { total: venues.length, osm: count('osm'), overture: count('overture'), both: venues.filter((v) => v.sources.length > 1).length },
    venues: venues.map(({ confidence: _c, ...v }) => v),
  };
  writeFileSync('data/venues-riyadh.json', JSON.stringify(out) + '\n');
  console.log(out.counts, `${venues.filter((v) => v.kind === 'cafe').length} cafés`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
