/**
 * Deduplication engine — decides whether a listing from one platform is the same auction as an
 * existing canonical auction (e.g. an Infath auction re-published on Mobasher and Athmann).
 *
 * Signals: shared cross-reference ids, normalised title, organiser, start/end dates,
 * asset count and asset locations. Two listings from the SAME source are never merged.
 */
import { placeKey } from './geo';

export interface DedupRecord {
  sourceIds: string[]; // sources already attached (for a canonical auction) or [sourceId] (for a listing)
  normalizedTitle: string;
  normalizedOrganizer?: string | null;
  category?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  cities?: string[];
  assetCount?: number | null;
  crossRefs?: string[];
}

const HOUR = 3_600_000;

export function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' ').filter((w) => w.length > 1));
  const tb = new Set(b.split(' ').filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment * 0.9);
}

function dateClose(a?: Date | null, b?: Date | null, toleranceH = 3): number | null {
  if (!a || !b) return null; // unknown
  return Math.abs(a.getTime() - b.getTime()) <= toleranceH * HOUR ? 1 : 0;
}

export interface MatchResult { score: number; reason: string }

export function matchScore(listing: DedupRecord, auction: DedupRecord): MatchResult {
  if (listing.sourceIds.some((s) => auction.sourceIds.includes(s))) return { score: 0, reason: 'same-source' };

  const refs = new Set(auction.crossRefs ?? []);
  if ((listing.crossRefs ?? []).some((r) => refs.has(r))) return { score: 1, reason: 'cross-ref' };

  if (listing.category && auction.category && listing.category !== auction.category) return { score: 0, reason: 'category' };

  const title = tokenSimilarity(listing.normalizedTitle, auction.normalizedTitle);
  if (title < 0.5) return { score: 0, reason: 'title' };

  const start = dateClose(listing.startAt, auction.startAt);
  const end = dateClose(listing.endAt, auction.endAt);
  if (start === 0 || end === 0) return { score: 0, reason: 'dates' }; // known & different → different auction
  if (start === null && end === null) return { score: 0, reason: 'no-dates' }; // too risky to merge

  const org = listing.normalizedOrganizer && auction.normalizedOrganizer
    ? (tokenSimilarity(listing.normalizedOrganizer, auction.normalizedOrganizer) >= 0.5 ? 1 : 0)
    : null;
  const words = Math.min(listing.normalizedTitle.split(' ').length, auction.normalizedTitle.split(' ').length);
  // Different organisers: only an exact, specific title may still match (e.g. Infath owner vs executing company).
  if (org === 0 && !(title === 1 && words >= 3)) return { score: 0, reason: 'organizer' };
  // Very generic titles ("مزاد سيارات") need a confirmed organiser.
  if (words <= 2 && org !== 1) return { score: 0, reason: 'generic-title' };

  const la = new Set((listing.cities ?? []).map(placeKey));
  const ab = (auction.cities ?? []).map(placeKey);
  const city = la.size && ab.length ? (ab.some((c) => la.has(c)) ? 1 : 0) : null;
  if (city === 0) return { score: 0, reason: 'location' };

  const assets = listing.assetCount && auction.assetCount ? (listing.assetCount === auction.assetCount ? 1 : 0) : null;

  let score = title * 0.55 + (start ?? 0.5) * 0.15 + (end ?? 0.5) * 0.15;
  score += org === 1 ? 0.1 : org === null ? 0.04 : 0;
  score += city === 1 ? 0.05 : 0;
  score += assets === 1 ? 0.05 : assets === 0 ? -0.05 : 0;
  return { score: Math.min(1, score), reason: 'scored' };
}

export const MATCH_THRESHOLD = 0.78;

export function findBestMatch<T extends DedupRecord>(listing: DedupRecord, candidates: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const { score } = matchScore(listing, c);
    if (score >= MATCH_THRESHOLD && score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
