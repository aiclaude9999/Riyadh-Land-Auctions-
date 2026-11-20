/**
 * Time-of-day rules, all in Riyadh time (UTC+3, no daylight saving), whatever the server's clock zone.
 *
 * - Typical traffic (free mode only; Google mode uses live traffic): car times without traffic are
 *   multiplied by a factor per hour. Based on TomTom Traffic Index 2025 for Riyadh: a 10 km drive
 *   takes ~12 min at night, ~18 min around 8 am and ~24 min around 4–5 pm on working days.
 * - Metro hours: as announced by Riyadh Public Transport (@RiyadhTransport, the operator): Sat–Thu
 *   5:30–24:00, Fri 10:00–24:00. Ramadan and holidays differ (not handled). Configurable below.
 * - Prayer: times from the `adhan` library (Umm al-Qura method). Shops may legally stay open since 2021,
 *   but some cafés/restaurants still pause service around prayer, so this is a gentle warning only.
 */
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import { RIYADH_CENTER } from './geo';

const RIYADH_OFFSET_MIN = 3 * 60;

export interface RiyadhClock {
  /** 0 = Sunday … 5 = Friday, 6 = Saturday */
  day: number;
  /** minutes since midnight */
  minutes: number;
}

export function riyadhClock(d: Date): RiyadhClock {
  const local = new Date(d.getTime() + RIYADH_OFFSET_MIN * 60_000);
  return { day: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export const isWeekend = (day: number) => day === 5 || day === 6; // Friday, Saturday

// Minutes per 10 km (TomTom 2025 averages, rounded) for each hour; free-flow ≈ 11.5.
const WORKDAY = [13, 12.5, 12, 12, 11.5, 12, 14.5, 17.5, 18, 17.5, 17.5, 17.5, 17, 17, 21, 22.5, 24, 24, 22, 19, 18, 17.5, 16.5, 15];
const WEEKEND = [15, 14, 13, 12.5, 12, 12, 12, 12, 12, 12.5, 13, 13, 13.5, 14, 14, 14.5, 15, 16.5, 17.5, 18, 18, 17.5, 17, 16];
const FREE_FLOW = 11.5;

/** Typical slowdown vs. an empty road (≥ 1). Interpolated between whole hours. */
export function trafficFactor(at: Date): number {
  const { day, minutes } = riyadhClock(at);
  const table = isWeekend(day) ? WEEKEND : WORKDAY;
  const h = Math.floor(minutes / 60);
  const f = (minutes % 60) / 60;
  const v = table[h] * (1 - f) + table[(h + 1) % 24] * f;
  return Math.max(1, v / FREE_FLOW);
}

export const METRO_HOURS = {
  /** Sat–Thu */
  normal: { open: 5 * 60 + 30, close: 24 * 60 },
  /** Friday */
  friday: { open: 10 * 60, close: 24 * 60 },
};

/** Is the metro running at this moment? */
export function metroRunning(at: Date): boolean {
  const { day, minutes } = riyadhClock(at);
  const h = day === 5 ? METRO_HOURS.friday : METRO_HOURS.normal;
  return minutes >= h.open && minutes < h.close;
}

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface PrayerHit {
  name: PrayerName;
  /** ISO time of the adhan */
  time: string;
}

/** Window around each adhan in which some places pause service. */
export const PRAYER_WINDOW = { beforeMin: 10, afterMin: 25 };

function prayersOn(d: Date): { name: PrayerName; at: Date }[] {
  const local = new Date(d.getTime() + RIYADH_OFFSET_MIN * 60_000);
  // adhan wants a calendar date; use the Riyadh date at noon
  const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 9));
  const pt = new PrayerTimes(new Coordinates(RIYADH_CENTER.lat, RIYADH_CENTER.lng), date, CalculationMethod.UmmAlQura());
  return [
    { name: 'Fajr', at: pt.fajr },
    { name: 'Dhuhr', at: pt.dhuhr },
    { name: 'Asr', at: pt.asr },
    { name: 'Maghrib', at: pt.maghrib },
    { name: 'Isha', at: pt.isha },
  ];
}

/** The prayer whose pause window overlaps [from, to] (e.g. the arrival window), if any. */
export function prayerOverlap(from: Date, to: Date): PrayerHit | undefined {
  const days = [new Date(from.getTime() - 86_400_000), from, to];
  for (const d of days) {
    for (const p of prayersOn(d)) {
      const start = p.at.getTime() - PRAYER_WINDOW.beforeMin * 60_000;
      const end = p.at.getTime() + PRAYER_WINDOW.afterMin * 60_000;
      if (start <= to.getTime() && end >= from.getTime()) return { name: p.name, time: p.at.toISOString() };
    }
  }
  return undefined;
}

/** A Riyadh-local day (0 = today) and time (minutes since midnight) → Date. */
export function riyadhDate(dayOffset: number, minutes: number, now: Date = new Date()): Date {
  const local = new Date(now.getTime() + RIYADH_OFFSET_MIN * 60_000);
  const midnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - RIYADH_OFFSET_MIN * 60_000;
  return new Date(midnightUtc + dayOffset * 86_400_000 + minutes * 60_000);
}

/** "16:30" in Riyadh time. */
export function riyadhTimeLabel(d: Date): string {
  const { minutes } = riyadhClock(d);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export type TrafficLevel = 'light' | 'moderate' | 'heavy';
export function trafficLevel(factor: number): TrafficLevel {
  return factor < 1.3 ? 'light' : factor < 1.7 ? 'moderate' : 'heavy';
}
