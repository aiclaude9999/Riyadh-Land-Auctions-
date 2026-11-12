/**
 * Plot features from the deed boundaries ("الحدود والأطوال"): how many sides face a street,
 * the widest street, corner plot. Only what the source states — never guessed.
 *   Mobasher: {"SOUTH":"شارع عرض 20م بطول 35م", "WEST":"شارع عرض 18م بطول 19.82م", ...}
 *   Infath platform: NorthLimitName "شارع " / "ملك الغير" (no widths)
 */
import { normalizeArabic } from './normalize';

export type Side = 'north' | 'south' | 'east' | 'west';
export interface PlotFeatures { streetSides: number; streetWidth: number | null; corner: boolean }

const SIDE_KEYS: Record<string, Side> = { north: 'north', south: 'south', east: 'east', west: 'west', شمال: 'north', جنوب: 'south', شرق: 'east', غرب: 'west' };

function sideOf(key: string): Side | null {
  const k = normalizeArabic(key).replace(/limit.*|name|ي$/g, '').trim();
  for (const [w, s] of Object.entries(SIDE_KEYS)) if (k.startsWith(normalizeArabic(w))) return s;
  return null;
}

/** Street width in metres from text like "شارع عرض 20م" / "شارع بعرض 15 م" / "street 30m". */
export function streetWidthOf(text: string): number | null {
  const t = normalizeArabic(text);
  const m = t.match(/عرض\s*(\d+(?:\.\d+)?)/) ?? t.match(/(\d+(?:\.\d+)?)\s*m\b/);
  const w = m ? Number(m[1]) : NaN;
  return isFinite(w) && w > 0 && w <= 200 ? w : null;
}

const isStreet = (text: string) => /(^|\s)(شارع|طريق|ممر)(\s|$)|street|road/.test(normalizeArabic(text));

export function plotFeatures(boundaries: Record<string, string | null | undefined>): PlotFeatures | null {
  const streets = new Map<Side, number | null>();
  let seen = 0;
  for (const [key, val] of Object.entries(boundaries)) {
    const side = sideOf(key);
    if (!side || !val) continue;
    seen++;
    if (isStreet(val)) streets.set(side, streetWidthOf(val));
  }
  if (!seen) return null;
  const widths = [...streets.values()].filter((w): w is number => w != null);
  const has = (s: Side) => streets.has(s);
  const corner = (has('north') || has('south')) && (has('east') || has('west'));
  return { streetSides: streets.size, streetWidth: widths.length ? Math.max(...widths) : null, corner };
}

export function featuresLabel(f: { streetSides?: number | null; streetWidth?: number | null; corner?: boolean | null }): string | null {
  if (f.streetSides == null) return null;
  if (f.streetSides === 0) return 'لا يطل على شارع حسب الصك';
  const parts = [f.corner ? 'زاوية' : null, f.streetSides === 1 ? 'واجهة واحدة' : f.streetSides === 2 ? 'واجهتان' : `${f.streetSides} واجهات`, f.streetWidth ? `أعرض شارع ${f.streetWidth} م` : null];
  return parts.filter(Boolean).join(' · ');
}
