/**
 * Starting-point search: official neighbourhoods + well-known areas and landmarks (malls, hotels,
 * universities, hospitals, parks…). Works offline, English or Arabic spelling, several words.
 */
import { normalize, searchDistricts, shortAr, shortEn, type District } from './districts';
import { haversineMeters, type LatLng } from './geo';

export type LandmarkKind = 'mall' | 'hotel' | 'university' | 'hospital' | 'park' | 'stadium' | 'museum' | 'airport' | 'station' | 'embassy' | 'area';

export interface Landmark {
  name: string;
  nameAr?: string;
  kind: LandmarkKind;
  lat: number;
  lng: number;
  /** hand-checked well-known place: ranked above namesakes */
  famous?: boolean;
}

export type PlaceHit =
  | { type: 'district'; id: string; en: string; ar: string; center: LatLng; district: District }
  | { type: 'landmark'; id: string; en: string; ar: string; center: LatLng; kind: LandmarkKind };

// famous areas first, then the bigger landmark types
const KIND_ORDER: LandmarkKind[] = ['area', 'mall', 'university', 'airport', 'stadium', 'museum', 'park', 'station', 'hospital', 'hotel', 'embassy'];

function score(q: string, words: string[], names: string[]): number {
  let best = Infinity;
  for (const raw of names) {
    const n = normalize(raw);
    if (!n) continue;
    if (n === q) best = Math.min(best, 0);
    else if (n.startsWith(q)) best = Math.min(best, 1);
    else if (words.every((w) => n.split(' ').some((x) => x.startsWith(w)))) best = Math.min(best, 2);
    else if (n.includes(q)) best = Math.min(best, 3);
  }
  return best;
}

export function searchPlaces(query: string, districts: District[], landmarks: Landmark[], limit = 8): PlaceHit[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(' ').filter(Boolean);
  const ds: PlaceHit[] = searchDistricts(query, districts, 5).map((d) => ({ type: 'district', id: d.id, en: shortEn(d), ar: shortAr(d), center: d.center, district: d }));
  const ls = landmarks
    .map((l, i) => ({ l, i, s: score(q, words, [l.name, l.nameAr ?? '']) - (l.famous || l.kind === 'area' ? 1.5 : 0) }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => a.s - b.s || KIND_ORDER.indexOf(a.l.kind) - KIND_ORDER.indexOf(b.l.kind) || a.l.name.length - b.l.name.length)
    // the same building listed twice (e.g. "Kingdom-Centre", "Kingdom parking"): keep the best one
    .filter((x, k, all) => !all.slice(0, k).some((y) => y.l.kind === x.l.kind && haversineMeters(y.l, x.l) < 300))
    .slice(0, limit)
    .map(({ l, i }): PlaceHit => ({ type: 'landmark', id: `lm${i}`, en: l.name, ar: l.nameAr ?? l.name, center: { lat: l.lat, lng: l.lng }, kind: l.kind }));
  // exact/prefix district matches first, then landmarks, then weaker district matches
  const strongDistricts = ds.filter((d) => normalize(d.en).startsWith(q) || normalize(d.ar).startsWith(q));
  const rest = ds.filter((d) => !strongDistricts.includes(d));
  return [...strongDistricts, ...ls, ...rest].slice(0, limit);
}
