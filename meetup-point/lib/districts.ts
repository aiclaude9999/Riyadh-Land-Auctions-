import type { LatLng } from './geo';

export interface District {
  id: string;
  name_ar: string;
  name_en: string;
  center: LatLng;
  rings: [number, number][][]; // [lat, lng]
}

/** "Al Narjis Dist." → "Al Narjis"; "حي النرجس" → "النرجس" */
export const shortEn = (d: District) => d.name_en.replace(/\s*Dist\.?$/i, '').trim();
export const shortAr = (d: District) => d.name_ar.replace(/^حي\s+/, '').trim();

/** Folds spelling variants so "narjes", "Al-Narjis", "النرجس" and "نرجس" all match. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // Arabic diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^حي\s+/, '')
    .replace(/\bdist\.?$/, '')
    .replace(/[-'’`.]/g, ' ')
    .replace(/\b(al|an|ar|as|ash|ad|adh|at|az|ath|el)\s+/g, '') // English article "Al-", "An-" …
    .replace(/(^|\s)ال/g, '$1') // Arabic article
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/e/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ranked matches: name starts with the query first, then contains it. */
export function searchDistricts(query: string, districts: District[], limit = 8): District[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { d: District; s: number }[] = [];
  for (const d of districts) {
    const names = [normalize(d.name_en), normalize(d.name_ar)];
    let s = Infinity;
    for (const n of names) {
      if (n === q) s = Math.min(s, 0);
      else if (n.startsWith(q)) s = Math.min(s, 1);
      else if (n.split(' ').some((w) => w.startsWith(q))) s = Math.min(s, 2);
      else if (n.includes(q)) s = Math.min(s, 3);
    }
    if (s < Infinity) scored.push({ d, s });
  }
  return scored.sort((a, b) => a.s - b.s || shortEn(a.d).localeCompare(shortEn(b.d))).slice(0, limit).map((x) => x.d);
}

/** Even-odd point-in-polygon over all rings. */
export function inDistrict(p: LatLng, d: District): boolean {
  let inside = false;
  for (const ring of d.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function districtAt(p: LatLng, districts: District[]): District | undefined {
  return districts.find((d) => inDistrict(p, d));
}
