/**
 * Builds data/metro-stations.geojson and data/metro-lines.geojson from OpenStreetMap.
 *
 * The spec names the RCRC open data portal as the source, but in Nov 2026 the portal
 * (rcrc.opendatasoft.com → opendata.rcrc.gov.sa) answers "domain could not be found".
 * OSM has the full network (6 lines, 85 stations), licensed ODbL — keep the attribution on the map.
 * When RCRC is back, export its "metro stations by metro line and station type" dataset as GeoJSON
 * and map it to the same StationProps shape (lib/metro.ts).
 *
 * Run (in the cloud sandbox add NODE_USE_ENV_PROXY=1):  npm run build:metro
 */
import { writeFileSync } from 'node:fs';
import { haversineMeters } from '../lib/geo';
import type { StationCollection, StationFeature } from '../lib/metro';

// route=subway relations with network="Riyadh Metro" (one direction per line is enough)
const LINES = [
  { ref: '1', id: 8857089, name: 'Blue Line' },
  { ref: '2', id: 8857429, name: 'Red Line' },
  { ref: '3', id: 8857387, name: 'Orange Line' },
  { ref: '4', id: 8857389, name: 'Yellow Line' },
  { ref: '5', id: 8857090, name: 'Green Line' },
  { ref: '6', id: 8857388, name: 'Purple Line' },
];
const MERGE_METERS = 300; // stop positions of one interchange station on different lines

type El = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string>; members?: { type: string; ref: number; role: string }[] };
const r5 = (x: number) => +x.toFixed(5);

async function main() {
  const stations: StationFeature[] = [];
  const lineFeatures: unknown[] = [];

  for (const line of LINES) {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/relation/${line.id}/full.json`, {
      headers: { 'User-Agent': 'riyadh-meetup-point-prototype/0.1' },
    });
    if (!res.ok) throw new Error(`relation ${line.id}: HTTP ${res.status}`);
    const els = ((await res.json()) as { elements: El[] }).elements;
    const nodes = new Map(els.filter((e) => e.type === 'node').map((e) => [e.id, e] as const));
    const ways = new Map(els.filter((e) => e.type === 'way').map((e) => [e.id, e] as const));
    const rel = els.find((e) => e.type === 'relation' && e.id === line.id)!;
    const color = rel.tags?.colour ?? '#555555';

    const paths: [number, number][][] = [];
    const seen: string[] = [];
    for (const m of rel.members ?? []) {
      if (m.type === 'way' && (m.role === '' || m.role === 'route')) {
        const pts = (ways.get(m.ref)?.nodes ?? [])
          .map((id) => nodes.get(id))
          .filter((n): n is El => n?.lat != null)
          .map((n) => [r5(n.lon!), r5(n.lat!)] as [number, number]);
        if (pts.length >= 2) paths.push(pts);
      } else if (m.type === 'node' && m.role.startsWith('stop')) {
        const n = nodes.get(m.ref);
        if (n?.lat == null) continue;
        const rawAr = n.tags?.['name:ar'] ?? n.tags?.name ?? '';
        const nameEn = n.tags?.['name:en'] ?? n.tags?.name ?? rawAr;
        // keep only real Arabic names (OSM sometimes has Latin text or just "محطة" = "station")
        const nameAr = /[\u0600-\u06FF]/.test(rawAr) && rawAr.trim() !== 'محطة' ? rawAr.trim() : '';
        const key = nameEn || nameAr;
        if (!key || seen.includes(key)) continue; // other platform / direction of the same station
        const seq = seen.push(key) - 1;
        const pos = { lat: r5(n.lat), lng: r5(n.lon!) };
        const lineRef = { ref: line.ref, name: line.name, color, seq };
        const existing = stations.find(
          (s) => haversineMeters(pos, { lat: s.geometry.coordinates[1], lng: s.geometry.coordinates[0] }) <= MERGE_METERS,
        );
        if (existing) {
          existing.properties.lines.push(lineRef);
          existing.properties.interchange = true;
        } else {
          stations.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
            properties: { id: `osm-${n.id}`, name_en: nameEn, name_ar: nameAr, lines: [lineRef], interchange: false },
          });
        }
      }
    }
    lineFeatures.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: paths },
      properties: { ref: line.ref, name: line.name, color },
    });
    console.log(`${line.name}: ${paths.length} segments, ${seen.length} stations`);
    await new Promise((r) => setTimeout(r, 1000)); // be gentle with the OSM API
  }

  const metadata = { source: '© OpenStreetMap contributors', license: 'ODbL-1.0', generatedAt: new Date().toISOString() };
  const fc: StationCollection = { type: 'FeatureCollection', metadata, features: stations };
  writeFileSync('data/metro-stations.geojson', JSON.stringify(fc) + '\n');
  writeFileSync('data/metro-lines.geojson', JSON.stringify({ type: 'FeatureCollection', metadata, features: lineFeatures }) + '\n');
  console.log(`${stations.length} stations (${stations.filter((s) => s.properties.interchange).length} interchanges)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
