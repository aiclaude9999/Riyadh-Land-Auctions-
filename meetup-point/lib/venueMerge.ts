/**
 * Combine café/restaurant lists from several open sources into one, without duplicates.
 * Two entries are the same place when they are close (≤ 80 m) and their names match (same
 * normalised name, one contains the other, or most words shared). OSM ids are kept when a
 * place is in both, so saved favourites and hidden places keep working.
 */
import { haversineMeters } from './geo';
import type { Venue } from './venues';

export interface SourcedVenue extends Venue {
  sources: string[];
  confidence?: number;
}

const MATCH_M = 80;
const SAME_NAME_M = 40;

export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\b(restaurant|cafe|café|coffee|the|and|co|ksa|riyadh|branch)\b/g, ' ')
    .replace(/(^|\s)(مطعم|مقهى|كافيه|كوفي|فرع|الرياض)(?=\s|$)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const wx = new Set(x.split(' '));
  const wy = y.split(' ');
  const shared = wy.filter((w) => w.length > 1 && wx.has(w)).length;
  return shared / Math.max(1, Math.min(wx.size, wy.length)) >= 0.6;
}

/** Simple grid index so matching 10 000 places stays fast. */
function grid<T extends { location: { lat: number; lng: number } }>(items: T[], cell = 0.002) {
  const m = new Map<string, T[]>();
  const key = (lat: number, lng: number) => `${Math.floor(lat / cell)},${Math.floor(lng / cell)}`;
  for (const it of items) {
    const k = key(it.location.lat, it.location.lng);
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return {
    near(lat: number, lng: number): T[] {
      const cy = Math.floor(lat / cell);
      const cx = Math.floor(lng / cell);
      const out: T[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(...(m.get(`${cy + dy},${cx + dx}`) ?? []));
      return out;
    },
  };
}

/** `primary` wins on ids; `extra` adds missing places and fills empty fields. */
export function mergeVenues(primary: SourcedVenue[], extra: SourcedVenue[]): SourcedVenue[] {
  const out = primary.map((v) => ({ ...v }));
  const idx = grid(out);
  let added: SourcedVenue[] = [];
  for (const e of extra) {
    const match = idx
      .near(e.location.lat, e.location.lng)
      .concat(added)
      .find((v) => {
        const d = haversineMeters(v.location, e.location);
        return d <= MATCH_M && namesMatch(v.name, e.name) || (d <= SAME_NAME_M && !!v.nameAr && !!e.nameAr && namesMatch(v.nameAr, e.nameAr));
      });
    if (match) {
      match.sources = [...new Set([...match.sources, ...e.sources])];
      match.nameAr ??= e.nameAr;
      match.cuisine ??= e.cuisine;
      match.address ??= e.address;
      match.brand ??= e.brand;
      match.openingHours ??= e.openingHours;
      continue;
    }
    added.push({ ...e });
    if (added.length > 200) {
      // keep the linear "recently added" list short: move into a fresh index
      out.push(...added);
      added = [];
      Object.assign(idx, grid(out));
    }
  }
  return [...out, ...added];
}

/** Within one source: the same name at (almost) the same spot twice → keep the more confident one. */
export function dedupeSelf(list: SourcedVenue[]): SourcedVenue[] {
  const sorted = [...list].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const kept: SourcedVenue[] = [];
  const idx = grid(kept);
  let pending: SourcedVenue[] = [];
  for (const v of sorted) {
    const dup = idx
      .near(v.location.lat, v.location.lng)
      .concat(pending)
      .some((k) => haversineMeters(k.location, v.location) <= SAME_NAME_M && normName(k.name) === normName(v.name));
    if (dup) continue;
    pending.push(v);
    if (pending.length > 200) {
      kept.push(...pending);
      pending = [];
      Object.assign(idx, grid(kept));
    }
  }
  return [...kept, ...pending];
}
