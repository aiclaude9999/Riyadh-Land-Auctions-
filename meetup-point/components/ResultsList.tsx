'use client';

import { Car, ChevronDown, Heart, MapPinned, Star, ThumbsUp, TrainFront, Trophy, EyeOff, CheckCircle2, Navigation, Clock, Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import FairnessBars from './FairnessBars';
import TripDetails, { type RouteState } from './TripDetails';
import TripStrip from './TripStrip';
import { useLocale, useName, useT } from './LocaleProvider';
import { venueGroups } from '@/lib/cuisine';
import { googleReviewsUrl } from '@/lib/directions';
import type { LatLng } from '@/lib/geo';
import type { Style } from '@/lib/matching';
import { displayName, personColor, type Person } from '@/lib/people';
import type { Preferences } from '@/lib/preferences';
import type { RecommendResponse, ResultVenue } from '@/lib/recommendTypes';
import { routeKey } from '@/lib/routePieces';
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

/**
 * Results: ranking tabs, then ONE big card for the chosen place (fairness bars, each person's trip
 * strip, steps on demand, actions), then the other places as a sideways row (tap = choose, map follows).
 */
export default function ResultsList(props: Props) {
  const { response, people, stale, selectedId, onSelect, style, onStyle, onUseTime, fairnessNames } = props;
  const t = useT();
  const n = useName();
  const { meta } = response;
  const results = orderedResults(response, style);
  const rowRef = useRef<HTMLDivElement>(null);
  const hero = results.find((r) => r.venue.id === selectedId) ?? results[0];
  const others = results.filter((r) => r !== hero);
  // one time scale for all cards so the bars can be compared
  const scale = Math.max(...results.map((r) => r.maxEta), 1);

  useEffect(() => {
    rowRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [style]);

  if (!results.length || !hero) return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.noResults}</p>;

  return (
    <div className={stale ? 'opacity-60' : ''}>
      {stale && <p className="mb-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">{t.staleResults}</p>}

      <div role="tablist" className="mb-1 grid grid-cols-3 gap-1 rounded-xl bg-sand-dark/50 p-1">
        {(['fair', 'quick', 'best'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={style === s}
            onClick={() => onStyle(s)}
            className={`rounded-lg px-2 py-1.5 text-sm ${style === s ? 'bg-white font-semibold text-brand-dark shadow-card' : 'text-ink-soft hover:text-ink'}`}
          >
            {s === 'fair' ? t.styleFair : s === 'quick' ? t.styleQuick : t.styleBest}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-ink-soft">{style === 'fair' ? t.styleFairHelp : style === 'quick' ? t.styleQuickHelp : t.styleBestHelp}</p>

      {meta.betterTime && (
        <div className="mb-3 rounded-xl bg-sky-light p-2.5 text-xs text-sky">
          {t.betterTime(riyadhTimeLabel(new Date(meta.betterTime.departAt)), meta.betterTime.maxEta, meta.betterTime.saves)}{' '}
          {onUseTime && (
            <button type="button" className="font-semibold underline" onClick={() => onUseTime(meta.betterTime!.departAt)}>
              {t.useThisTime}
            </button>
          )}
        </div>
      )}
      {fairnessNames.length > 0 && <p className="mb-3 rounded-xl bg-violet-50 p-2.5 text-xs text-violet-900">{t.fairnessNote(fairnessNames.join(', '))}</p>}

      <HeroCard r={hero} {...props} scale={scale} />

      {others.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">{t.alternatives}</h3>
          <div ref={rowRef} className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {others.map((r) => (
              <button
                key={r.venue.id}
                type="button"
                onClick={() => onSelect(r.venue.id)}
                className="w-56 shrink-0 snap-start rounded-2xl border border-sand-dark bg-white p-3 text-start shadow-card hover:border-brand"
              >
                <div className="flex items-center gap-2">
                  <Rank rank={r.rank} small />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{n(r.venue.name, r.venue.nameAr)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {t.maxLabel}: <span className="font-semibold text-ink">{t.minutes(r.maxEta)}</span>
                </p>
                <div className="mt-2">
                  <FairnessBars etas={r.etas} people={people} scale={scale} compact />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {meta.timeOptions && meta.timeOptions.length > 1 && (
        <section className="mt-4">
          <p className="text-xs text-ink-soft">{t.timeStrip}</p>
          <div className="no-scrollbar mt-1 flex gap-1 overflow-x-auto pb-1">
            {meta.timeOptions.map((o) => {
              const current = Math.abs(Date.parse(o.departAt) - Date.parse(meta.leaveAt)) < 60_000;
              return (
                <button
                  key={o.departAt}
                  type="button"
                  disabled={!onUseTime || current}
                  onClick={() => onUseTime?.(o.departAt)}
                  title={o.blocked === 'metro' ? t.blockedMetro : o.blocked === 'prayer' ? t.blockedPrayer : undefined}
                  className={`shrink-0 rounded-lg border px-2 py-1 text-xs leading-tight ${current ? 'border-brand bg-brand-light font-semibold' : 'border-sand-dark bg-white hover:border-brand'} ${o.blocked === 'metro' ? 'opacity-50' : ''}`}
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
        </section>
      )}

      <Notes response={response} results={results} />
    </div>
  );
}

function Rank({ rank, small = false }: { rank: number; small?: boolean }) {
  const size = small ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${size} ${rank === 0 ? 'bg-sand-deep' : rank === 1 ? 'bg-brand' : 'bg-ink/80'}`}>
      {rank === 0 ? <Star size={small ? 13 : 15} /> : rank === 1 ? <Trophy size={small ? 13 : 15} /> : rank}
    </span>
  );
}

function HeroCard({ r, response, people, routes, onShowRoute, onZoom, prefs, onToggleFavourite, onHide, voting, onWeGo, savedIds, scale }: Props & { r: ResultVenue; scale: number }) {
  const t = useT();
  const n = useName();
  const { locale } = useLocale();
  const { meta } = response;
  const longest = r.etas.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const fav = prefs.favourites.includes(r.venue.id);
  const anyTaste = people.some((p) => (p.likes?.length ?? 0) + (p.avoids?.length ?? 0) > 0);
  const googleId = r.venue.id.startsWith('g-') ? r.venue.id.slice(2) : undefined;
  const votable = new Set((response.styles?.fair ?? response.results.map((x) => x.venue.id)).slice(0, 3));
  const topVotes = voting ? Math.max(0, ...[...votable].map((id) => voting.counts[id] ?? 0)) : 0;
  const saved = savedIds.includes(n(r.venue.name, r.venue.nameAr));
  const type = [t.venueTypes[r.venue.kind], locale === 'ar' ? venueGroups(r.venue).map((g) => t.groups[g]).join('، ') : r.venue.cuisine].filter(Boolean).join(' · ');
  const warnings = [
    r.warnings.prayer && `🕌 ${t.prayerWarn(t.prayers[r.warnings.prayer.name], riyadhTimeLabel(new Date(r.warnings.prayer.time)))}`,
    r.warnings.iftar && `🌙 ${t.iftarWarn}`,
    r.warnings.longWalk && `🚶 ${t.longWalkWarn(r.warnings.longWalk.map((i) => displayName(people[i], i, t.namePlaceholder)).join(', '))}`,
    r.warnings.metroClosed && `🚇 ${t.metroWarn(r.warnings.metroClosed.map((i) => displayName(people[i], i, t.namePlaceholder)).join(', '))}`,
    r.openAtArrival === false && `⚠️ ${t.closedAtArrival}`,
  ].filter(Boolean) as string[];
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${r.venue.location.lat},${r.venue.location.lng}`;
  // arrival in Riyadh time: late night / early morning = remind to check the place is open
  const arrival = riyadhClock(new Date(Date.parse(meta.leaveAt) + r.maxEta * 60_000)).minutes;
  const lateArrival = arrival >= 23 * 60 || arrival < 6 * 60;
  const leaveOf = (minutes: number) => {
    const at = Date.parse(meta.leaveAt) + (r.maxEta - minutes) * 60_000;
    return at <= Date.now() + 60_000 ? t.leaveNow : t.leaveAt(riyadhTimeLabel(new Date(at)));
  };
  const waText = t.waResult(
    n(r.venue.name, r.venue.nameAr),
    mapsLink,
    Math.round(r.maxEta),
    r.etas.map((e) => t.waLine(displayName(people[e.person], e.person, t.namePlaceholder), e.mode === 'metro' ? t.metro : t.car, leaveOf(e.minutes), Math.round(e.minutes))).join('\n'),
  );

  return (
    <article className="rounded-2xl border border-brand/30 bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Rank rank={r.rank} />
        <div className="min-w-0 flex-1">
          {r.rank === 0 && <p className="text-xs font-semibold uppercase tracking-wide text-sand-deep">{t.yourPick}</p>}
          <h2 className="text-lg font-bold leading-snug text-ink">
            {fav && <Heart size={16} className="me-1 inline fill-rose-500 text-rose-500" aria-hidden />}
            {n(r.venue.name, r.venue.nameAr)}
          </h2>
          {type && <p className="truncate text-sm text-ink-soft">{type}</p>}
        </div>
        <div className="shrink-0 text-end">
          <p className="text-2xl font-bold leading-none text-brand-dark tabular-nums">{Math.round(r.maxEta)}</p>
          <p className="text-xs text-ink-soft">{t.maxLabel}</p>
        </div>
      </div>

      <p className="mt-2 text-sm text-ink">{t.winnerWhy(String(Math.round(r.maxEta)), displayName(people[longest.person], longest.person, t.namePlaceholder))}</p>

      {/* badges: at most two, the most useful */}
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {r.match && anyTaste && (
          <span className={`rounded-full px-2 py-0.5 ${r.match.against ? 'bg-rose-50 text-rose-700' : 'bg-brand-light text-brand-dark'}`}>{t.fits(r.match.fits, r.match.people)}</span>
        )}
        {r.match?.metroFriendly ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-light px-2 py-0.5 text-sky">
            <TrainFront size={13} aria-hidden /> {t.noLineChange}
          </span>
        ) : r.nearStation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-light px-2 py-0.5 text-sky">
            <TrainFront size={13} aria-hidden /> {r.nearStation.meters} m
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <FairnessBars etas={r.etas} people={people} scale={scale} />
      </div>

      {r.openAtArrival === true ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <Clock size={14} aria-hidden /> {t.openAtArrival}
        </p>
      ) : r.openAtArrival == null ? (
        <p className={`mt-3 flex flex-wrap items-center gap-1.5 text-xs ${lateArrival ? 'rounded-xl bg-amber-50 p-2 text-amber-900' : 'text-ink-soft'}`}>
          <Clock size={14} aria-hidden /> {lateArrival ? t.lateCheck : `${t.hoursUnknown} —`}{' '}
          <a href={googleReviewsUrl(n(r.venue.name, r.venue.nameAr), r.venue.location, googleId)} target="_blank" rel="noreferrer" className="font-medium underline">
            {t.checkHours}
          </a>
        </p>
      ) : null}

      {warnings.length > 0 && (
        <details className="mt-3 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">
          <summary className="cursor-pointer select-none font-medium">⚠️ {warnings.length}</summary>
          <ul className="mt-1 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <h3 className="mt-4 text-sm font-semibold text-ink">{t.tripsOf}</h3>
      <ul className="mt-2 space-y-3">
        {r.etas.map((e) => {
          const who = people[e.person];
          const leave = Date.parse(meta.leaveAt) + (r.maxEta - e.minutes) * 60_000;
          return (
            <li key={e.person}>
              <div className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: personColor(e.person) }} aria-hidden />
                {e.mode === 'metro' ? <TrainFront size={15} aria-hidden className="text-ink-soft" /> : <Car size={15} aria-hidden className="text-ink-soft" />}
                <span className="min-w-0 flex-1 truncate font-medium">{displayName(who, e.person, t.namePlaceholder)}</span>
                <span className="text-xs text-ink-soft">{leave <= Date.now() + 60_000 ? t.leaveNow : t.leaveAt(riyadhTimeLabel(new Date(leave)))}</span>
                <span className="w-14 text-end font-semibold tabular-nums">{t.minutes(e.minutes)}</span>
              </div>
              <div className="mt-1 ps-5">
                <TripStrip eta={e} />
                {who?.location && (
                  <details className="group mt-1">
                    <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-xs text-brand">
                      {t.detailsToggle} <ChevronDown size={13} className="transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <TripDetails
                      eta={e}
                      from={who.location}
                      to={r.venue.location}
                      route={routes[routeKey('car', who.location, r.venue.location)]}
                      onShowRoute={() => onShowRoute(e.person)}
                      onZoom={onZoom}
                    />
                  </details>
                )}
                {who?.location && (
                  <button type="button" onClick={() => onShowRoute(e.person)} className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-brand">
                    <MapPinned size={13} aria-hidden /> {t.showRoute}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {voting && votable.has(r.venue.id) && r.rank !== 0 && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            aria-pressed={voting.mine === r.venue.id}
            onClick={() => voting.onVote(voting.mine === r.venue.id ? null : r.venue.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${voting.mine === r.venue.id ? 'border-brand bg-brand text-white' : 'border-sand-dark text-ink hover:border-brand'}`}
          >
            <ThumbsUp size={14} aria-hidden /> {voting.mine === r.venue.id ? t.voted : t.vote}
          </button>
          <span className="text-xs text-ink-soft">{t.votesCount(voting.counts[r.venue.id] ?? 0)}</span>
          {topVotes > 0 && (voting.counts[r.venue.id] ?? 0) === topVotes && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">🏆 {t.mostVotes}</span>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={saved}
          onClick={() => onWeGo(r.venue.id)}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-brand-light disabled:text-brand-dark"
        >
          <CheckCircle2 size={16} aria-hidden /> {saved ? t.saved : t.weGo.replace(/^✅\s*/, '')}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
          target="_blank"
          rel="noreferrer"
          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          <Send size={16} aria-hidden /> {t.sendWhatsApp}
        </a>
        <a
          href={googleReviewsUrl(n(r.venue.name, r.venue.nameAr), r.venue.location, googleId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-sand-dark px-2 py-1.5 text-xs text-ink hover:border-brand"
        >
          <Star size={14} aria-hidden /> {t.reviews}
        </a>
        <a
          href={mapsLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-sand-dark px-2 py-1.5 text-xs text-ink hover:border-brand"
        >
          <Navigation size={14} aria-hidden /> {t.openInMaps}
        </a>
        <button type="button" onClick={() => onToggleFavourite(r.venue.id)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-sand-dark px-2 py-1.5 text-xs text-ink hover:border-rose-300">
          <Heart size={14} aria-hidden className={fav ? 'fill-rose-500 text-rose-500' : ''} /> {fav ? t.unfavourite : t.favourite}
        </button>
        <button type="button" onClick={() => onHide(r.venue.id)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-sand-dark px-2 py-1.5 text-xs text-ink hover:border-rose-300 hover:text-rose-600">
          <EyeOff size={14} aria-hidden /> {t.hide}
        </button>
      </div>
    </article>
  );
}

function Notes({ response, results }: { response: RecommendResponse; results: ResultVenue[] }) {
  const t = useT();
  const { meta } = response;
  const anyEstimated = results.some((r) => r.etas.some((e) => e.source === 'estimated'));
  const anyMetro = results.some((r) => r.etas.some((e) => e.mode === 'metro'));
  const anyCar = results.some((r) => r.etas.some((e) => e.mode === 'car'));
  const leave = new Date(meta.leaveAt);
  const leaveLabel = `${t.weekdays[riyadhClock(leave).day]} ${riyadhTimeLabel(leave)}`;
  return (
    <details className="mt-4 text-xs text-ink-soft">
      <summary className="cursor-pointer select-none font-medium">{t.aboutTimes}</summary>
      <div className="mt-1 space-y-1">
        <p>{meta.dataSource === 'google' ? t.sourceGoogle : t.sourceFree}</p>
        <p>{t.matchNote}</p>
        {meta.heat && anyMetro && <p>{t.heatNote(meta.heat.tempC, meta.heat.factor.toFixed(1), meta.heat.source === 'forecast')}</p>}
        {meta.ramadan && <p>🌙 {t.ramadanNote}</p>}
        {anyCar && meta.traffic.kind === 'typical' && <p>{t.trafficNote(leaveLabel, meta.traffic.factor.toFixed(1))}</p>}
        {meta.carSource === 'estimate' && <p className="text-amber-700">{t.carEstimated}</p>}
        {anyMetro && meta.metroSource !== 'google-transit' && <p>{t.metroEstimatedNote}</p>}
        {anyEstimated && <p>{t.estimatedHelp}</p>}
      </div>
    </details>
  );
}
