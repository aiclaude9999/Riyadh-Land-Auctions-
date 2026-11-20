'use client';

import { CUISINE_GROUPS, type CuisineGroup } from '@/lib/cuisine';
import { t } from '@/lib/i18n';
import { riyadhClock, riyadhDate, trafficFactor, trafficLevel } from '@/lib/timing';
import type { VenueType } from '@/lib/venues';

export interface TripState {
  venueType: VenueType;
  departMode: 'now' | 'later';
  /** days from today (Riyadh) */
  departDay: number;
  /** minutes since midnight (Riyadh), 30-min steps */
  departMinutes: number;
  nearMetro: boolean;
  food: CuisineGroup | null;
}

export function initialTrip(now = new Date()): TripState {
  const { minutes } = riyadhClock(now);
  const next = Math.ceil((minutes + 60) / 30) * 30; // about an hour from now
  return { venueType: 'both', departMode: 'now', departDay: next >= 24 * 60 ? 1 : 0, departMinutes: next % (24 * 60), nearMetro: false, food: null };
}

/** The departure as a Date, or undefined for "now". */
export function departDate(trip: TripState): Date | undefined {
  return trip.departMode === 'later' ? riyadhDate(trip.departDay, trip.departMinutes) : undefined;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const segment = (active: boolean) => `rounded-md px-2 py-1 text-sm ${active ? 'bg-white font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;

export default function TripOptions({ trip, onChange }: { trip: TripState; onChange: (t: TripState) => void }) {
  const today = riyadhClock(new Date()).day;
  const dayName = (offset: number) => (offset === 0 ? t.dayToday : offset === 1 ? t.dayTomorrow : t.weekdays[(today + offset) % 7]);
  const when = departDate(trip) ?? new Date();
  const level = trafficLevel(trafficFactor(when));
  const levelColor = level === 'heavy' ? 'text-rose-600' : level === 'moderate' ? 'text-amber-600' : 'text-emerald-600';

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
            <button key={m} type="button" role="radio" aria-checked={trip.departMode === m} className={segment(trip.departMode === m)} onClick={() => onChange({ ...trip, departMode: m })}>
              {m === 'now' ? t.departNow : t.departLater}
            </button>
          ))}
        </div>
        {trip.departMode === 'later' && (
          <select
            aria-label={t.departLater}
            value={trip.departDay}
            onChange={(e) => onChange({ ...trip, departDay: Number(e.target.value) })}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {Array.from({ length: 7 }, (_, i) => (
              <option key={i} value={i}>
                {dayName(i)}
              </option>
            ))}
          </select>
        )}
      </div>

      {trip.departMode === 'later' && (
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{t.timeLabel}</span>
          <input
            type="range"
            min={0}
            max={23.5 * 60}
            step={30}
            value={trip.departMinutes}
            aria-label={t.timeLabel}
            aria-valuetext={hhmm(trip.departMinutes)}
            onChange={(e) => onChange({ ...trip, departMinutes: Number(e.target.value) })}
            className="min-w-0 flex-1 accent-brand"
          />
          <span className="w-28 shrink-0 text-end text-xs">
            <span className="font-semibold tabular-nums">{hhmm(trip.departMinutes)}</span> · <span className={levelColor}>{t.trafficLevels[level]}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{t.filtersLabel}</span>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" checked={trip.nearMetro} onChange={(e) => onChange({ ...trip, nearMetro: e.target.checked })} className="accent-brand" />
          🚇 {t.nearMetroOnly}
        </label>
        <select
          aria-label={t.anyFood}
          value={trip.food ?? ''}
          onChange={(e) => onChange({ ...trip, food: (e.target.value || null) as CuisineGroup | null })}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          <option value="">{t.anyFood}</option>
          {CUISINE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {t.groups[g]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
