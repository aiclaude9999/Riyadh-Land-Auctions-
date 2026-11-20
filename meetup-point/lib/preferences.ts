/**
 * The group's preferences. Saved only in this browser (localStorage) — nothing is stored on a server.
 * Sent with each search so the ranking can use them.
 */
import { CUISINE_GROUPS, venueGroups, type CuisineGroup } from './cuisine';
import type { Venue } from './venues';

export interface Preferences {
  likes: CuisineGroup[];
  avoids: CuisineGroup[];
  /** venue ids */
  favourites: string[];
  hidden: string[];
}

export const EMPTY_PREFS: Preferences = { likes: [], avoids: [], favourites: [], hidden: [] };
export const LIKE_BONUS_MIN = 2;
export const FAVOURITE_BONUS_MIN = 3;
const MAX_IDS = 200;

/** Cleans anything coming from the browser or from storage. */
export function sanitizePrefs(raw: unknown): Preferences {
  const r = (raw ?? {}) as Partial<Record<keyof Preferences, unknown>>;
  const groups = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((g): g is CuisineGroup => CUISINE_GROUPS.includes(g as CuisineGroup)))] : []);
  const ids = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string' && s.length < 200))].slice(-MAX_IDS) : []);
  return { likes: groups(r.likes), avoids: groups(r.avoids), favourites: ids(r.favourites), hidden: ids(r.hidden) };
}

/** Drop hidden places and avoided food (a place is avoided only if ALL its groups are avoided). */
export function allowedByPrefs(v: Venue, p: Preferences): boolean {
  if (p.hidden.includes(v.id)) return false;
  const g = venueGroups(v);
  return !(g.length && p.avoids.length && g.every((x) => p.avoids.includes(x)));
}

export interface PrefMatch {
  bonusMin: number;
  liked: CuisineGroup[];
  favourite: boolean;
}

/** Minutes taken off a venue's score: −2 if it serves a liked food, −3 if it is a favourite. */
export function prefBonus(v: Venue, p: Preferences): PrefMatch {
  const liked = venueGroups(v).filter((g) => p.likes.includes(g));
  const favourite = p.favourites.includes(v.id);
  return { bonusMin: (liked.length ? LIKE_BONUS_MIN : 0) + (favourite ? FAVOURITE_BONUS_MIN : 0), liked, favourite };
}
