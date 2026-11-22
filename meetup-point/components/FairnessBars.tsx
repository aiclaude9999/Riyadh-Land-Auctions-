'use client';

import { useT } from './LocaleProvider';
import { displayName, personColor, type Person } from '@/lib/people';
import type { ScoredEta } from '@/lib/scoring';

/**
 * The app's signature visual: one bar per person, as long as their trip, in their colour.
 * Balanced bars = a fair place. `scale` = minutes that fill the bar (shared across cards to compare).
 */
export default function FairnessBars({ etas, people, scale, compact = false }: { etas: ScoredEta[]; people: Person[]; scale: number; compact?: boolean }) {
  const t = useT();
  return (
    <ul className={compact ? 'space-y-1' : 'space-y-1.5'} aria-label={t.fairnessTitle}>
      {etas.map((e) => {
        const pct = Math.max(6, Math.min(100, (e.minutes / Math.max(scale, 1)) * 100));
        return (
          <li key={e.person} className="flex items-center gap-2">
            {!compact && <span className="w-16 shrink-0 truncate text-xs text-ink-soft">{displayName(people[e.person], e.person, t.namePlaceholder)}</span>}
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sand-dark/60">
              <span className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${pct}%`, background: personColor(e.person) }} />
            </span>
            {!compact && <span className="w-14 shrink-0 text-end text-xs tabular-nums text-ink">{t.minutes(e.minutes)}</span>}
          </li>
        );
      })}
    </ul>
  );
}
