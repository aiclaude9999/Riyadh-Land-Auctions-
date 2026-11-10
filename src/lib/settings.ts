import { prisma } from './db';
import type { GeoFilter } from './geo';

export interface AppSettings {
  intervals: {
    discoveryMin: number;
    liveMin: number;
    closingMin: number;
    upcomingMin: number;
    endedMin: number;
    uiRefreshSec: number;
  };
  closingWindowMin: number;
  defaultGeo: GeoFilter;
  telegram: { enabled: boolean; chatId: string };
}

export const DEFAULT_SETTINGS: AppSettings = {
  intervals: { discoveryMin: 30, liveMin: 10, closingMin: 3, upcomingMin: 60, endedMin: 1440, uiRefreshSec: 60 },
  closingWindowMin: 60,
  defaultGeo: 'riyadh_city',
  telegram: { enabled: false, chatId: '' },
};

const clamp = (n: unknown, min: number, max: number, d: number) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d;
};

export function sanitizeSettings(input: any): AppSettings {
  const d = DEFAULT_SETTINGS;
  const i = input?.intervals ?? {};
  return {
    intervals: {
      discoveryMin: clamp(i.discoveryMin, 5, 1440, d.intervals.discoveryMin),
      liveMin: clamp(i.liveMin, 2, 720, d.intervals.liveMin),
      closingMin: clamp(i.closingMin, 1, 60, d.intervals.closingMin),
      upcomingMin: clamp(i.upcomingMin, 5, 1440, d.intervals.upcomingMin),
      endedMin: clamp(i.endedMin, 60, 10080, d.intervals.endedMin),
      uiRefreshSec: clamp(i.uiRefreshSec, 15, 3600, d.intervals.uiRefreshSec),
    },
    closingWindowMin: clamp(input?.closingWindowMin, 10, 240, d.closingWindowMin),
    defaultGeo: ['riyadh_city', 'riyadh_region', 'all'].includes(input?.defaultGeo) ? input.defaultGeo : d.defaultGeo,
    telegram: { enabled: !!input?.telegram?.enabled, chatId: String(input?.telegram?.chatId ?? '').slice(0, 64) },
  };
}

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'app' } });
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...((row?.value as object) ?? {}) });
}

export async function saveSettings(input: unknown): Promise<AppSettings> {
  const s = sanitizeSettings(input);
  await prisma.setting.upsert({ where: { key: 'app' }, create: { key: 'app', value: s as any }, update: { value: s as any } });
  return s;
}
