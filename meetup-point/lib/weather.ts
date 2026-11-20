/**
 * Heat-aware walking. Walking counts more when it is hot: factor = 1 + (feels-like °C − 25) / 15,
 * between 1 (≤ 25 °C) and 2 (≥ 40 °C). Temperature: Open-Meteo forecast (free, no key) when available,
 * otherwise typical Riyadh temperatures for that month and hour (climate averages).
 */
import { riyadhClock } from './timing';

// Typical daily low / high in Riyadh per month (°C, long-term averages, rounded).
const LOW = [9, 11, 15, 20, 26, 28, 30, 29, 26, 21, 15, 10];
const HIGH = [20, 23, 28, 33, 40, 43, 44, 44, 41, 35, 27, 22];

/** Typical temperature: coldest ~6 am, hottest ~3 pm (smooth curve between). */
export function typicalTempC(at: Date): number {
  const local = new Date(at.getTime() + 3 * 3600_000);
  const m = local.getUTCMonth();
  const h = riyadhClock(at).minutes / 60;
  // 0 at 6:00 rising to 1 at 15:00, falling back to 0 at 6:00 next day
  const x = h >= 6 && h <= 15 ? (h - 6) / 9 : h > 15 ? 1 - (h - 15) / 15 : 1 - (h + 9) / 15;
  const w = (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, x)))) / 2;
  return LOW[m] + (HIGH[m] - LOW[m]) * w;
}

export function heatFactorFor(tempC: number): number {
  return +Math.min(2, Math.max(1, 1 + (tempC - 25) / 15)).toFixed(2);
}

export interface Heat {
  tempC: number;
  factor: number;
  source: 'forecast' | 'typical';
}

type OpenMeteo = { hourly?: { time: string[]; apparent_temperature?: (number | null)[]; temperature_2m?: (number | null)[] } };

/** Picks the forecast hour (times are Riyadh local "YYYY-MM-DDTHH:00"). */
export function forecastTemp(json: OpenMeteo, at: Date): number | null {
  const h = json.hourly;
  if (!h?.time?.length) return null;
  const local = new Date(at.getTime() + 3 * 3600_000).toISOString().slice(0, 13) + ':00';
  const i = h.time.indexOf(local);
  if (i < 0) return null;
  const v = h.apparent_temperature?.[i] ?? h.temperature_2m?.[i];
  return typeof v === 'number' ? v : null;
}

export function heatFrom(json: OpenMeteo | null, at: Date): Heat {
  const f = json ? forecastTemp(json, at) : null;
  const tempC = Math.round(f ?? typicalTempC(at));
  return { tempC, factor: heatFactorFor(tempC), source: f != null ? 'forecast' : 'typical' };
}
