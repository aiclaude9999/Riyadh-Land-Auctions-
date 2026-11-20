import type { Style } from './matching';
import type { RecommendResponse, ResultVenue } from './recommendTypes';

/**
 * The places of one ranking style in order, numbered 1…n (the user's own ★ pick, rank 0, stays first).
 * Older responses without styles fall back to the plain order.
 */
export function orderedResults(resp: RecommendResponse, style: Style): ResultVenue[] {
  const pick = resp.results.filter((r) => r.rank === 0);
  const ids = resp.styles?.[style];
  const rest = resp.results.filter((r) => r.rank !== 0);
  const list = ids ? ids.map((id) => rest.find((r) => r.venue.id === id)).filter((r): r is ResultVenue => !!r) : rest.slice(0, 5);
  return [...pick, ...list.map((r, i) => ({ ...r, rank: i + 1 }))];
}
