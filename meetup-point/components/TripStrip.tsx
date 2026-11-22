'use client';

import { Car, Footprints } from 'lucide-react';
import { useT } from './LocaleProvider';
import type { MetroLeg } from '@/lib/estimator';
import { personColor } from '@/lib/people';
import type { ScoredEta } from '@/lib/scoring';

interface Seg {
  key: string;
  minutes: number;
  color: string;
  kind: 'walk' | 'car' | 'ride' | 'wait';
  label: string;
}

/**
 * Citymapper-style strip: the whole trip as coloured pieces, widths proportional to time.
 * walk = grey, waits/changes = light, metro rides = line colour, car = the person's colour.
 */
export default function TripStrip({ eta }: { eta: ScoredEta }) {
  const t = useT();
  const segs: Seg[] = [];
  if (eta.mode === 'car') {
    segs.push({ key: 'car', minutes: eta.minutes, color: personColor(eta.person), kind: 'car', label: t.minutes(eta.minutes) });
  } else {
    (eta.detail?.legs ?? []).forEach((l: MetroLeg, i) => {
      if (l.kind === 'walk') segs.push({ key: `w${i}`, minutes: l.minutes, color: '#9AA3AE', kind: 'walk', label: String(Math.round(l.minutes)) });
      else if (l.kind === 'drive') segs.push({ key: `d${i}`, minutes: l.minutes, color: '#475569', kind: 'car', label: String(Math.round(l.minutes)) });
      else if (l.kind === 'ride') segs.push({ key: `r${i}`, minutes: l.minutes, color: l.color, kind: 'ride', label: t.lineNames[l.line] ?? l.lineName });
      else segs.push({ key: `x${i}`, minutes: l.minutes, color: '#E5E1D8', kind: 'wait', label: '' });
    });
    if (!segs.length) segs.push({ key: 'w', minutes: eta.minutes, color: '#9AA3AE', kind: 'walk', label: t.minutes(eta.minutes) });
  }
  const total = segs.reduce((s, x) => s + x.minutes, 0) || 1;
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-md" role="img" aria-label={segs.map((s) => `${s.kind} ${Math.round(s.minutes)}`).join(', ')}>
      {segs.map((s) => (
        <span
          key={s.key}
          title={`${s.label} · ${t.minutes(s.minutes)}`}
          className="flex min-w-[18px] items-center justify-center gap-0.5 overflow-hidden border-e border-white/70 px-1 text-xs font-medium last:border-e-0"
          style={{ flexGrow: Math.max(s.minutes, total * 0.06), flexBasis: 0, background: s.color, color: s.kind === 'wait' ? '#5B6573' : '#fff' }}
        >
          {s.kind === 'walk' && <Footprints size={13} aria-hidden className="shrink-0" />}
          {s.kind === 'car' && <Car size={13} aria-hidden className="shrink-0" />}
          <span className="truncate">{s.kind === 'ride' ? s.label.replace(/ ?Line$/, '').replace(/^المسار /, '') : s.kind === 'wait' ? '' : s.label}</span>
        </span>
      ))}
    </div>
  );
}
