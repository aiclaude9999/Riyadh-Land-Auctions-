'use client';

import { useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';
import { displayName, personColor, type Person } from '@/lib/people';
import type { RecommendResponse } from '@/lib/recommendTypes';

interface Props {
  response: RecommendResponse;
  /** People as they were when the search ran (names/colours stay correct if the panel changes). */
  people: Person[];
  stale: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const fmt = (m: number) => String(Math.round(m));

export default function ResultsList({ response, people, stale, selectedId, onSelect }: Props) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  const { results, meta } = response;
  const anyEstimated = results.some((r) => r.etas.some((e) => e.source === 'estimated'));
  const anyMetro = results.some((r) => r.etas.some((e) => e.mode === 'metro'));

  useEffect(() => {
    if (selectedId) refs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  if (!results.length) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t.noResults}</p>;

  return (
    <div className={stale ? 'opacity-60' : ''}>
      {stale && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{t.staleResults}</p>}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t.topPlaces(results.length)}</h2>
      <ol className="space-y-2">
        {results.map((r) => {
          const selected = r.venue.id === selectedId;
          const worst = r.etas[r.worstPerson];
          const worstName = displayName(people[r.worstPerson], r.worstPerson);
          return (
            <li
              key={r.venue.id}
              ref={(el) => {
                if (el) refs.current.set(r.venue.id, el);
                else refs.current.delete(r.venue.id);
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(r.venue.id)}
                aria-pressed={selected}
                className={`w-full rounded-xl border bg-white p-3 text-start shadow-sm transition ${selected ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${r.rank === 1 ? 'bg-brand' : 'bg-slate-700'}`}>{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.venue.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[t.venueTypes[r.venue.kind], r.venue.cuisine, r.venue.rating != null ? `★ ${r.venue.rating.toFixed(1)}` : null, r.venue.address].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-end text-xs text-slate-500">
                    <span className="block text-base font-semibold text-slate-900">{fmt(worst.minutes)} min</span>
                    max
                  </span>
                </div>

                <ul className="mt-2 space-y-1">
                  {r.etas.map((e) => (
                    <li key={e.person} className="flex items-baseline gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: personColor(e.person) }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {e.mode === 'metro' ? '🚇' : '🚗'} {displayName(people[e.person], e.person)}
                        {e.mode === 'metro' && e.detail && (
                          <span className="block text-xs text-slate-400">
                            {e.detail.walkOnly ? t.walkOnly : t.metroRoute(e.detail.fromStation ?? '', e.detail.toStation ?? '', e.detail.transfers ?? 0)} · {t.walking(fmt(e.walkMinutes))}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">{fmt(e.minutes)} min</span>
                      <span
                        className={`shrink-0 rounded px-1 text-[10px] font-medium uppercase ${e.source === 'estimated' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                        title={e.source === 'estimated' ? t.estimatedHelp : undefined}
                      >
                        {e.source === 'estimated' ? t.estimated : meta.carSource === 'google-traffic' || e.mode === 'metro' ? t.live : t.noTraffic}
                      </span>
                    </li>
                  ))}
                </ul>

                {selected && (
                  <ul className="mt-2 list-disc space-y-0.5 border-t border-slate-100 ps-5 pt-2 text-xs text-slate-600">
                    <li>{t.fairnessWhy(fmt(worst.minutes), worstName)}</li>
                    {people.length > 1 && <li>{t.spreadWhy(fmt(r.spreadMin))}</li>}
                    {r.nearStation && <li>{t.stationWhy(r.nearStation.meters, r.nearStation.name, r.nearStation.bonusMin)}</li>}
                  </ul>
                )}
              </button>
              {selected && (
                <a
                  className="mt-1 inline-block ps-1 text-xs text-brand hover:underline"
                  href={`https://www.google.com/maps/search/?api=1&query=${r.venue.location.lat},${r.venue.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.openInMaps} ↗
                </a>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p>{meta.dataSource === 'google' ? t.sourceGoogle : t.sourceFree}</p>
        {meta.carSource === 'estimate' && <p className="text-amber-700">{t.carEstimated}</p>}
        {anyMetro && meta.metroSource !== 'google-transit' && <p>{t.metroEstimatedNote}</p>}
        {anyEstimated && <p>{t.estimatedHelp}</p>}
      </div>
    </div>
  );
}
