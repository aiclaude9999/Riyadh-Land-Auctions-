'use client';

/**
 * Past meetups, kept only in this browser. Used for:
 * - fairness over time: someone who travelled longer than the others recently gets a weight > 1,
 *   so today's ranking spares them a bit (between ×0.9 and ×1.25);
 * - "how long did it really take?" reports, which teach the app (POST /api/feedback).
 */
export interface Meetup {
  id: string;
  date: string;
  venue: string;
  people: { name: string; mode: 'car' | 'metro'; minutes: number; actual?: number }[];
}

const KEY = 'meetup.history.v1';
const MAX = 20;

export function loadHistory(): Meetup[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Meetup[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: Meetup[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage blocked */
  }
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Weight per current person from the last 5 meetups: average of (their minutes − that meetup's
 * average), 15 min more than the others → ×1.25. Unknown names → 1.
 */
export function fairnessWeights(names: string[], history: Meetup[]): number[] {
  const recent = history.slice(-5);
  return names.map((name) => {
    const diffs = recent.flatMap((m) => {
      const me = m.people.find((p) => norm(p.name) === norm(name));
      if (!me || m.people.length < 2) return [];
      const avg = m.people.reduce((s, p) => s + (p.actual ?? p.minutes), 0) / m.people.length;
      return [(me.actual ?? me.minutes) - avg];
    });
    if (!diffs.length) return 1;
    const d = diffs.reduce((s, x) => s + x, 0) / diffs.length;
    return +Math.min(1.25, Math.max(0.9, 1 + d / 60)).toFixed(2);
  });
}
