/**
 * How well a place suits the group (phase 2), next to how fair the trips are.
 * - taste: each person's liked / avoided food groups → "fits 3 of 4";
 * - place score 0–100: taste fit (50) + liked by someone actively (20) + easy for metro users (15)
 *   + group favourite / liked food (15). No price, parking or family-section data exists for free,
 *   so those are not part of it.
 */
import { venueGroups, type CuisineGroup } from './cuisine';
import type { Preferences } from './preferences';
import type { ScoredVenue } from './scoring';
import type { Venue } from './venues';

export interface Taste {
  likes?: CuisineGroup[];
  avoids?: CuisineGroup[];
}

export interface Match {
  /** people the place suits (no dislike; a like, or no likes given) */
  fits: number;
  /** people who actively like its food */
  loves: number;
  /** people who would rather avoid it */
  against: number;
  people: number;
  score: number;
  /** every metro user gets there without changing lines and with a short last walk */
  metroFriendly?: boolean;
}

export function tasteMatch(v: Venue, tastes: Taste[], metroMeters: number | null, prefs: Preferences): Match {
  const g = venueGroups(v);
  let fits = 0;
  let loves = 0;
  let against = 0;
  for (const t of tastes) {
    const likes = t.likes ?? [];
    const avoids = t.avoids ?? [];
    const hates = g.length > 0 && avoids.length > 0 && g.every((x) => avoids.includes(x));
    const likesIt = g.some((x) => likes.includes(x));
    if (hates) against++;
    else if (likesIt || likes.length === 0) fits++;
    if (likesIt) loves++;
  }
  const n = Math.max(1, tastes.length);
  const metroEase = metroMeters == null ? 0.5 : Math.max(0, 1 - metroMeters / 800);
  const groupPref = prefs.favourites.includes(v.id) ? 1 : g.some((x) => prefs.likes.includes(x)) ? 0.5 : 0;
  const score = Math.round(50 * (fits / n) + 20 * (loves / n) + 15 * metroEase + 15 * groupPref);
  return { fits, loves, against, people: tastes.length, score };
}

export type Style = 'fair' | 'quick' | 'best';

/**
 * Three rankings of the same scored places:
 * fair  = the normal score (longest trip, minimax);
 * quick = least total travel;
 * best  = highest place score among places whose longest trip is within +25 % (+5 min) of the fairest.
 */
export function rankStyles(scored: (ScoredVenue & { match: Match })[], topN = 5): Record<Style, string[]> {
  const fair = scored.slice(0, topN).map((r) => r.venue.id);
  const quick = [...scored].sort((a, b) => a.sumEta - b.sumEta).slice(0, topN).map((r) => r.venue.id);
  const bestFair = Math.min(...scored.map((r) => r.maxEta));
  const best = scored
    .filter((r) => r.maxEta <= bestFair * 1.25 + 5 && r.match.against === 0)
    .sort((a, b) => b.match.score - a.match.score || a.score - b.score)
    .slice(0, topN)
    .map((r) => r.venue.id);
  return { fair, quick, best };
}
