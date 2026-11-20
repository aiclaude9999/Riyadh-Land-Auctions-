'use client';

import { t } from '@/lib/i18n';
import type { VenueType } from '@/lib/venues';

export interface TripState {
  venueType: VenueType;
  departMode: 'now' | 'later';
  /** value of <input type="datetime-local">, local time */
  departLocal: string;
}

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const segment = (active: boolean) => `rounded-md px-2 py-1 text-sm ${active ? 'bg-white font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;

export default function TripOptions({ trip, onChange }: { trip: TripState; onChange: (t: TripState) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{t.venueTypeLabel}</span>
        <div role="radiogroup" aria-label={t.venueTypeLabel} className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {(['cafe', 'restaurant', 'both'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={trip.venueType === v} className={segment(trip.venueType === v)} onClick={() => onChange({ ...trip, venueType: v })}>
              {t.venueTypes[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{t.departLabel}</span>
        <div role="radiogroup" aria-label={t.departLabel} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(['now', 'later'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={trip.departMode === m}
              className={segment(trip.departMode === m)}
              onClick={() => onChange({ ...trip, departMode: m, departLocal: trip.departLocal || toLocalInput(new Date(Date.now() + 3600_000)) })}
            >
              {m === 'now' ? t.departNow : t.departLater}
            </button>
          ))}
        </div>
        {trip.departMode === 'later' && (
          <input
            type="datetime-local"
            aria-label={t.departLater}
            value={trip.departLocal}
            min={toLocalInput(new Date())}
            onChange={(e) => onChange({ ...trip, departLocal: e.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
