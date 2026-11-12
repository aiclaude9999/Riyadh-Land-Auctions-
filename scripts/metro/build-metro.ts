/**
 * Build src/data/riyadh-metro.json (Riyadh Metro lines + stations) from OpenStreetMap.
 * Data © OpenStreetMap contributors, ODbL — keep the attribution on the map.
 * One route relation per line (one direction is enough for drawing); downloaded once with the
 * official OSM API (/api/0.6/relation/{id}/full). Re-run only if the lines change:
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/metro/build-metro.ts
 */
import { writeFileSync } from 'node:fs';
import { simplifyRing } from '../../src/lib/deals';

// relation ids found with an Overpass search: route=subway, network="Riyadh Metro"
const LINES = [
  { ref: '1', id: 8857089, name: 'المسار الأزرق', nameEn: 'Blue Line' },
  { ref: '2', id: 8857429, name: 'المسار الأحمر', nameEn: 'Red Line' },
  { ref: '3', id: 8857387, name: 'المسار البرتقالي', nameEn: 'Orange Line' },
  { ref: '4', id: 8857389, name: 'المسار الأصفر', nameEn: 'Yellow Line' },
  { ref: '5', id: 8857090, name: 'المسار الأخضر', nameEn: 'Green Line' },
  { ref: '6', id: 8857388, name: 'المسار البنفسجي', nameEn: 'Purple Line' },
];

type El = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string>; members?: { type: string; ref: number; role: string }[] };
const r5 = (x: number) => +x.toFixed(5);

async function main() {
  const out = [];
  for (const line of LINES) {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/relation/${line.id}/full.json`, { headers: { 'User-Agent': 'mazad-radar-map/1.0' } });
    if (!res.ok) throw new Error(`relation ${line.id}: HTTP ${res.status}`);
    const els = ((await res.json()) as { elements: El[] }).elements;
    const nodes = new Map(els.filter((e) => e.type === 'node').map((e) => [e.id, e] as const));
    const ways = new Map(els.filter((e) => e.type === 'way').map((e) => [e.id, e] as const));
    const rel = els.find((e) => e.type === 'relation' && e.id === line.id)!;
    const colour = rel.tags?.colour ?? '#555';
    const paths: [number, number][][] = [];
    const stations: { name: string; lat: number; lng: number }[] = [];
    for (const m of rel.members ?? []) {
      if (m.type === 'way' && (m.role === '' || m.role === 'route')) {
        const pts = (ways.get(m.ref)?.nodes ?? []).map((n) => nodes.get(n)).filter((n): n is El => !!n && n.lat != null)
          .map((n) => [n.lat!, n.lon!] as [number, number]);
        if (pts.length >= 2) paths.push(simplifyRing(pts, 0.00005).map(([a, b]) => [r5(a), r5(b)]));
      } else if (m.type === 'node' && m.role.startsWith('stop')) {
        const n = nodes.get(m.ref);
        const name = n?.tags?.['name:ar'] ?? n?.tags?.name;
        if (n?.lat != null && name && !stations.some((s) => s.name === name)) stations.push({ name, lat: r5(n.lat), lng: r5(n.lon!) });
      }
    }
    out.push({ ref: line.ref, name: line.name, nameEn: line.nameEn, colour, paths, stations });
    console.log(`${line.nameEn}: ${paths.length} segments, ${stations.length} stations`);
    await new Promise((r) => setTimeout(r, 1000)); // be gentle with the OSM API
  }
  writeFileSync('src/data/riyadh-metro.json', JSON.stringify({ source: '© OpenStreetMap contributors (ODbL)', generatedAt: new Date().toISOString(), lines: out }) + '\n');
}
main();
