/**
 * Learning from real trips: after a meetup people can say how long the trip really took.
 * We keep the last 100 ratios (actual ÷ estimated) per mode and use their median to scale future
 * estimates — only once there are at least 5 reports, and never beyond ×0.75 … ×1.4.
 */
import type { Store } from './store.server';

const KEY = 'meetup:calibration';
const VER = 'meetup:calibration:v';
const TTL = 365 * 86_400;
const KEEP = 100;
const MIN_REPORTS = 5;

export type CalibMode = 'car' | 'metro';
type Doc = Record<CalibMode, number[]>;

export interface Calibration {
  car: number;
  metro: number;
  reports: Record<CalibMode, number>;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function factorFrom(ratios: number[]): number {
  if (ratios.length < MIN_REPORTS) return 1;
  return Math.min(1.4, Math.max(0.75, median(ratios)));
}

export async function getCalibration(store: Store): Promise<Calibration> {
  const raw = await store.get(KEY).catch(() => null);
  const doc: Doc = raw ? (JSON.parse(raw) as Doc) : { car: [], metro: [] };
  return { car: factorFrom(doc.car), metro: factorFrom(doc.metro), reports: { car: doc.car.length, metro: doc.metro.length } };
}

/** Adds one report. Returns false when the numbers make no sense (ignored). */
export async function addReport(store: Store, mode: unknown, estimated: unknown, actual: unknown): Promise<boolean> {
  const m: CalibMode | null = mode === 'car' || mode === 'metro' ? mode : null;
  const est = Number(estimated);
  const act = Number(actual);
  if (!m || !(est >= 3 && est <= 240) || !(act >= 1 && act <= 300)) return false;
  const ratio = Math.min(2.5, Math.max(0.4, act / est));
  for (let i = 0; i < 5; i++) {
    const [raw, ver] = await Promise.all([store.get(KEY), store.get(VER)]);
    const doc: Doc = raw ? (JSON.parse(raw) as Doc) : { car: [], metro: [] };
    doc[m] = [...doc[m], +ratio.toFixed(3)].slice(-KEEP);
    if (await store.compareAndSet(KEY, VER, Number(ver ?? '0'), JSON.stringify(doc), TTL)) return true;
  }
  return false;
}
