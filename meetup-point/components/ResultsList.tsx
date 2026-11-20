'use client';

import { useEffect, useRef } from 'react';
import TripDetails, { type RouteState } from './TripDetails';
import { venueGroups } from '@/lib/cuisine';
import { googleReviewsUrl } from '@/lib/directions';
import type { LatLng } from '@/lib/geo';
import { routeKey } from '@/lib/routePieces';
import { useLocale, useName, useT } from './LocaleProvider';
import { displayName, personColor, type Person } from '@/lib/people';
import type { Preferences } from '@/lib/preferences';
import type { RecommendResponse } from '@/lib/recommendTypes';
import type { Style } from '@/lib/matching';
import { orderedResults } from '@/lib/styleOrder';
import { riyadhClock, riyadhTimeLabel } from '@/lib/timing';

interface Props {
  response: RecommendResponse;
  /** People as they were when the search ran (names/colours stay correct if the panel changes). */
  people: Person[];
  stale: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  routes: Record<string, RouteState>;
  /** focus the map on one person's route */
  onShowRoute: (person: number) => void;
  /** zoom the map to these points (a step) */
  onZoom: (points: LatLng[]) => void;
  prefs: Preferences;
  onToggleFavourite: (id: string) => void;
  onHide: (id: string) => void;
  /** shared group: votes on the top 3 */
  voting?: { counts: Record<string, number>; mine: string | null; onVote: (venueId: string | null) => void };
  style: Style;
  onStyle: (s: Style) => void;
  /** best-time strip: search again leaving at this time */
  onUseTime?: (iso: string) => void;
  onWeGo: (venueId: string) => void;
  /** venue names already saved as past meetups (to show "saved") */
  savedIds: string[];
  fairnessNames: string[];
}

const fmt = (m: number) => String(Math.round(m));

export default function ResultsList({ response, people, stale, selectedId, onSelect, routes, onShowRoute, onZoom, prefs, onToggleFavourite, onHide, voting, style, onStyle, onUseTime, onWeGo, savedIds, fairnessNames }: Props) {
  const t = useT();
  const n = useName();
  const { locale } = useLocale();
  const refs = useRef(new Map<string, HTMLLIElement>());
  const { meta } = response;
  const results = orderedResults(response, style);
  // votes are on the fairest top 3 (what everyone in the group sees first)
  const votable = new Set((response.styles?.fair ?? response.results.map((r) => r.venue.id)).slice(0, 3));
  const anyTaste = people.some((p) => (p.likes?.length ?? 0) + (p.avoids?.length ?? 0) > 0);
  const anyEstimated = results.some((r) => r.etas.some((e) => e.source === 'estimated'));
  const anyMetro = results.some((r) => r.etas.some((e) => e.mode === 'metro'));
  const anyCar = results.some((r) => r.etas.some((e) => e.mode === 'car'));
  const leave = new Date(meta.leaveAt);
  const leaveLabel = `${t.weekdays[riyadhClock(leave).day]} ${riyadhTimeLabel(leave)}`;

  useEffect(() => {
    if (selectedId) refs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const topVotes = voting ? Math.max(0, ...[...votable].map((id) => voting.counts[id] ?? 0)) : 0;

  if (!results.length) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t.noResults}</p>;

  return (
    <div className={stale ? 'opacity-60' : ''}>
      {stale && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{t.staleResults}</p>}
      <div role="tablist" className="mb-1 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
        {(['fair', 'quick', 'best'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={style === s}
            onClick={() => onStyle(s)}
            className={`rounded-md px-2 py-1 text-sm ${style === s ? 'bg-white font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {s === 'fair' ? `⚖️ ${t.styleFair}` : s === 'quick' ? `⚡ ${t.styleQuick}` : `⭐ ${t.styleBest}`}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-slate-500">{style === 'fair' ? t.styleFairHelp : style === 'quick' ? t.styleQuickHelp : t.styleBestHelp}</p>

      {meta.betterTime && (
        <div className="mb-2 rounded-lg bg-indigo-50 p-2 text-xs text-indigo-900">
          {t.betterTime(riyadhTimeLabel(new Date(meta.betterTime.departAt)), meta.betterTime.maxEta, meta.betterTime.saves)}{' '}
          {onUseTime && (
            <button type="button" className="font-semibold underline" onClick={() => onUseTime(meta.betterTime!.departAt)}>
              {t.useThisTime}
            </button>
          )}
        </div>
      )}
      {meta.timeOptions && meta.timeOptions.length > 1 && (
        <div className="mb-2">
          <p className="text-[11px] text-slate-500">{t.timeStrip}</p>
          <div className="mt-1 flex gap-1 overflow-x-auto pb-1">
            {meta.timeOptions.map((o) => {
              const current = Math.abs(Date.parse(o.departAt) - Date.parse(meta.leaveAt)) < 60_000;
              return (
                <button
                  key={o.departAt}
                  type="button"
                  disabled={!onUseTime || current}
                  onClick={() => onUseTime?.(o.departAt)}
                  title={o.blocked === 'metro' ? t.blockedMetro : o.blocked === 'prayer' ? t.blockedPrayer : undefined}
                  className={`shrink-0 rounded-md border px-2 py-1 text-[11px] leading-tight ${current ? 'border-brand bg-brand-light font-semibold' : 'border-slate-200 bg-white hover:border-brand'} ${o.blocked === 'metro' ? 'opacity-50' : ''}`}
                >
                  <span className="block tabular-nums">{riyadhTimeLabel(new Date(o.departAt))}</span>
                  <span className="block">
                    {o.blocked === 'metro' ? '🚇✕ ' : o.blocked === 'prayer' ? '🕌 ' : ''}
                    {t.minutes(o.maxEta)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {fairnessNames.length > 0 && <p className="mb-2 rounded-lg bg-violet-50 p-2 text-xs text-violet-900">⚖️ {t.fairnessNote(fairnessNames.join(', '))}</p>}
      <ol className="space-y-2">
        {results.map((r) => {
          const selected = r.venue.id === selectedId;
          // the real longest trip (the score itself also counts metro walking 1.5×)
          const longest = r.etas.reduce((a, b) => (b.minutes > a.minutes ? b : a));
          const longestName = displayName(people[longest.person], longest.person, t.namePlaceholder);
          const fav = prefs.favourites.includes(r.venue.id);
          const googleId = r.venue.id.startsWith('g-') ? r.venue.id.slice(2) : undefined;
          return (
            <li
              key={r.venue.id}
              ref={(el) => {
                if (el) refs.current.set(r.venue.id, el);
                else refs.current.delete(r.venue.id);
              }}
              onClick={() => onSelect(r.venue.id)}
              className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition ${selected ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-start gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${r.rank === 0 ? 'bg-amber-700' : r.rank === 1 ? 'bg-brand' : 'bg-slate-700'}`}>{r.rank === 0 ? '★' : r.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {fav && <span className="text-amber-500">★ </span>}
                    {n(r.venue.name, r.venue.nameAr)}
                  </p>
                  {r.rank === 0 && <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{t.yourPick}</p>}
                  <p className="truncate text-xs text-slate-500">
                    {[t.venueTypes[r.venue.kind], locale === 'ar' ? venueGroups(r.venue).filter((g) => g !== 'coffee' || r.venue.kind !== 'cafe').map((g) => t.groups[g]).join('، ') || null : r.venue.cuisine, r.venue.rating != null ? `★ ${r.venue.rating.toFixed(1)}` : null, r.venue.address].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-end text-xs text-slate-500">
                  <span className="block text-base font-semibold text-slate-900">{t.minutes(r.maxEta)}</span>
                  {t.maxLabel}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
                {r.match && anyTaste && (
                  <span className={`rounded-full px-2 py-0.5 ${r.match.against ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>👥 {t.fits(r.match.fits, r.match.people)}</span>
                )}
                {r.match && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{t.placeScore(r.match.score)}</span>}
                {r.match?.metroFriendly && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">🚇 {t.noLineChange}</span>}
                {r.openAtArrival === false && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">⚠️ {t.closedAtArrival}</span>}
                {r.openAtArrival === true && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">🕒 {t.openAtArrival}</span>}
              </div>

              {voting && votable.has(r.venue.id) && r.rank !== 0 && (
                <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-pressed={voting.mine === r.venue.id}
                    onClick={() => voting.onVote(voting.mine === r.venue.id ? null : r.venue.id)}
                    className={`rounded-full border px-3 py-0.5 text-sm ${voting.mine === r.venue.id ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-700 hover:border-brand'}`}
                  >
                    👍 {voting.mine === r.venue.id ? t.voted : t.vote}
                  </button>
                  <span className="text-xs text-slate-600">{t.votesCount(voting.counts[r.venue.id] ?? 0)}</span>
                  {topVotes > 0 && (voting.counts[r.venue.id] ?? 0) === topVotes && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">🏆 {t.mostVotes}</span>
                  )}
                </div>
              )}

              {(r.warnings.prayer || r.warnings.metroClosed || r.warnings.longWalk || r.warnings.iftar) && (
                <div className="mt-2 space-y-1 text-xs">
                  {r.warnings.prayer && (
                    <p className="rounded-md bg-sky-50 px-2 py-1 text-sky-900">🕌 {t.prayerWarn(t.prayers[r.warnings.prayer.name], riyadhTimeLabel(new Date(r.warnings.prayer.time)))}</p>
                  )}
                  {r.warnings.iftar && <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">🌙 {t.iftarWarn}</p>}
                  {r.warnings.longWalk && (
                    <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">🚶 {t.longWalkWarn(r.warnings.longWalk.map((i) => displayName(people[i], i, t.namePlaceholder)).join(', '))}</p>
                  )}
                  {r.warnings.metroClosed && (
                    <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                      🚇 {t.metroWarn(r.warnings.metroClosed.map((i) => displayName(people[i], i, t.namePlaceholder)).join(', '))}
                    </p>
                  )}
                </div>
              )}

              <ul className="mt-2 space-y-1.5">
                {r.etas.map((e) => (
                  <li key={e.person} className="text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: personColor(e.person) }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {e.mode === 'metro' ? '🚇' : '🚗'} {displayName(people[e.person], e.person, t.namePlaceholder)}
                        {!selected && e.mode === 'metro' && e.detail && (
                          <span className="block text-xs text-slate-400">
                            {e.detail.walkOnly
                              ? t.walkOnly
                              : t.metroRoute(n(e.detail.fromStation ?? '', e.detail.fromStationAr), n(e.detail.toStation ?? '', e.detail.toStationAr), e.detail.transfers ?? 0)}{' '}
                            · {t.walking(fmt(e.walkMinutes))}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-end tabular-nums">
                        {t.minutes(e.minutes)}
                        {(() => {
                          // everyone arrives together: leave at (arrival − own trip)
                          const leave = Date.parse(meta.leaveAt) + (r.maxEta - e.minutes) * 60_000;
                          return <span className="block text-[10px] text-slate-500">{leave <= Date.now() + 60_000 ? t.leaveNow : t.leaveAt(riyadhTimeLabel(new Date(leave)))}</span>;
                        })()}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1 text-[10px] font-medium uppercase ${e.source === 'estimated' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                        title={e.source === 'estimated' ? t.estimatedHelp : undefined}
                      >
                        {e.source === 'estimated' ? t.estimated : meta.carSource === 'google-traffic' || e.mode === 'metro' ? t.live : t.typicalTraffic}
                      </span>
                    </div>
                    {selected && people[e.person]?.location && (
                      <div className="ps-4">
                        <TripDetails
                          eta={e}
                          from={people[e.person].location!}
                          to={r.venue.location}
                          route={routes[routeKey('car', people[e.person].location!, r.venue.location)]}
                          onShowRoute={() => onShowRoute(e.person)}
                          onZoom={onZoom}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {selected && (
                <>
                  <ul className="mt-3 list-disc space-y-0.5 border-t border-slate-100 ps-5 pt-2 text-xs text-slate-600">
                    <li>{t.fairnessWhy(fmt(r.maxEta), longestName)}</li>
                    {people.length > 1 && <li>{t.spreadWhy(fmt(r.spreadMin))}</li>}
                    {r.nearStation && <li>{t.stationWhy(r.nearStation.meters, n(r.nearStation.name, r.nearStation.nameAr), r.nearStation.bonusMin)}</li>}
                    {r.pref?.liked.length ? <li>{t.likedWhy(r.pref.liked.map((g) => t.groups[g]).join(', '))}</li> : null}
                    {r.pref?.favourite && <li>{t.favouriteWhy}</li>}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={googleReviewsUrl(n(r.venue.name, r.venue.nameAr), r.venue.location, googleId)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
                    >
                      ⭐ {t.reviews} ↗
                    </a>
                    <button type="button" onClick={() => onToggleFavourite(r.venue.id)} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-amber-400">
                      {fav ? `★ ${t.unfavourite}` : `☆ ${t.favourite}`}
                    </button>
                    <button
                      type="button"
                      disabled={savedIds.includes(n(r.venue.name, r.venue.nameAr))}
                      onClick={() => onWeGo(r.venue.id)}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-900"
                    >
                      {savedIds.includes(n(r.venue.name, r.venue.nameAr)) ? t.saved : t.weGo}
                    </button>
                    <button type="button" onClick={() => onHide(r.venue.id)} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-rose-300 hover:text-rose-600">
                      🚫 {t.hide}
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p>{meta.dataSource === 'google' ? t.sourceGoogle : t.sourceFree}</p>
        <p>{t.matchNote}</p>
        {meta.heat && anyMetro && <p>{t.heatNote(meta.heat.tempC, meta.heat.factor.toFixed(1), meta.heat.source === 'forecast')}</p>}
        {meta.ramadan && <p>🌙 {t.ramadanNote}</p>}
        {anyCar && meta.traffic.kind === 'typical' && <p>{t.trafficNote(leaveLabel, meta.traffic.factor.toFixed(1))}</p>}
        {meta.carSource === 'estimate' && <p className="text-amber-700">{t.carEstimated}</p>}
        {anyMetro && meta.metroSource !== 'google-transit' && <p>{t.metroEstimatedNote}</p>}
        {anyEstimated && <p>{t.estimatedHelp}</p>}
      </div>
    </div>
  );
}
