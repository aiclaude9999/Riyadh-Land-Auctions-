'use client';

import { useState } from 'react';
import { googleDirectionsUrl, type CarRoute } from '@/lib/directions';
import type { MetroLeg } from '@/lib/estimator';
import type { LatLng } from '@/lib/geo';
import { useName, useT } from './LocaleProvider';
import type { ScoredEta } from '@/lib/scoring';

export type RouteState = CarRoute | 'loading' | 'error' | undefined;

const fmt = (m: number) => String(Math.max(1, Math.round(m)));

interface StepItem {
  icon: React.ReactNode;
  text: string;
  sub?: string;
  zoom?: LatLng[];
}

function StepList({ items, onZoom }: { items: StepItem[]; onZoom: (p: LatLng[]) => void }) {
  return (
    <ol className="mt-1 space-y-0.5 border-s-2 border-slate-200 ps-2">
      {items.map((it, i) => (
        <li key={i}>
          <button
            type="button"
            disabled={!it.zoom}
            onClick={(e) => {
              e.stopPropagation();
              if (it.zoom) onZoom(it.zoom);
            }}
            className="flex w-full gap-2 rounded px-1 py-0.5 text-start text-xs text-slate-700 hover:bg-brand-light/60 disabled:hover:bg-transparent"
          >
            <span className="w-4 shrink-0 text-center" aria-hidden>
              {it.icon}
            </span>
            <span className="min-w-0 flex-1">
              {it.text}
              {it.sub && <span className="block text-slate-500">{it.sub}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function MetroSteps({ legs, from, to, onZoom }: { legs: MetroLeg[]; from: LatLng; to: LatLng; onZoom: (p: LatLng[]) => void }) {
  const t = useT();
  const n = useName();
  const items: StepItem[] = [];
  const walkAll = legs.length === 1 && legs[0].kind === 'walk';
  const rides = legs.filter((l): l is Extract<MetroLeg, { kind: 'ride' }> => l.kind === 'ride');
  let lastRideEnd: LatLng | undefined;
  for (const l of legs) {
    if (l.kind === 'walk') {
      if (walkAll) items.push({ icon: '🚶', text: t.stepWalkAll(fmt(l.minutes)), zoom: [from, to] });
      else if (l.to === 'station') items.push({ icon: '🚶', text: t.stepWalkToStation(fmt(l.minutes), n(l.station ?? '', l.stationAr)), zoom: [from, rides[0].path[0]] });
      else items.push({ icon: '🚶', text: t.stepWalkToVenue(fmt(l.minutes)), zoom: lastRideEnd ? [lastRideEnd, to] : [to] });
    } else if (l.kind === 'drive') {
      items.push({ icon: '🚗', text: t.stepDriveToStation(fmt(l.minutes), n(l.station, l.stationAr)), zoom: [from, rides[0].path[0]] });
    } else if (l.kind === 'wait') {
      items.push({ icon: '⏱', text: t.stepWait(fmt(l.minutes)), zoom: rides[0] ? [rides[0].path[0]] : undefined });
    } else if (l.kind === 'transfer') {
      items.push({ icon: '🔁', text: t.stepTransfer(n(l.at, l.atAr), t.lineNames[l.toLineRef] ?? l.toLine), zoom: lastRideEnd ? [lastRideEnd] : undefined });
    } else {
      items.push({
        icon: <span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: l.color }} />,
        text: t.stepRide(t.lineNames[l.line] ?? l.lineName, n(l.toward, l.towardAr), l.stops),
        sub: `${t.stepGetOff(n(l.to, l.toAr))} · ~${t.minutes(l.minutes)}`,
        zoom: l.path,
      });
      lastRideEnd = l.path.at(-1);
    }
  }
  return <StepList items={items} onZoom={onZoom} />;
}

function CarSteps({ route, onZoom }: { route: RouteState; onZoom: (p: LatLng[]) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (route === 'loading' || route === undefined) return <p className="mt-1 text-xs text-slate-400">{t.loadingRoute}</p>;
  if (route === 'error') return <p className="mt-1 text-xs text-amber-700">{t.routeFailed}</p>;
  return (
    <>
      <p className="mt-1 text-xs text-slate-500">
        {t.carSummary(route.km.toFixed(1), fmt(route.minutes))} ·{' '}
        <button
          type="button"
          aria-expanded={open}
          className="text-brand hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          {open ? t.hideSteps : `${t.showSteps} (${route.steps.length})`}
        </button>
      </p>
      {open && (
        <StepList
          onZoom={onZoom}
          items={route.steps.map((s, i) => ({
            icon: <span className="text-slate-400">{i + 1}</span>,
            text: t.carStep(s),
            sub: s.meters > 0 ? t.distance(s.meters) : undefined,
            zoom: s.at ? [s.at] : undefined,
          }))}
        />
      )}
    </>
  );
}

/** One person's trip: route on the map, steps (tap to zoom), and real directions in Google Maps. */
export default function TripDetails({ eta, from, to, route, onShowRoute, onZoom }: { eta: ScoredEta; from: LatLng; to: LatLng; route: RouteState; onShowRoute: () => void; onZoom: (p: LatLng[]) => void }) {
  const t = useT();
  return (
    <div className="mt-1">
      {eta.mode === 'metro' ? eta.detail?.legs ? <MetroSteps legs={eta.detail.legs} from={from} to={to} onZoom={onZoom} /> : null : <CarSteps route={route} onZoom={onZoom} />}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowRoute();
          }}
          className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-dark"
        >
          🗺 {t.showRoute}
        </button>
        <a
          href={googleDirectionsUrl(from, to, eta.mode)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-brand hover:text-brand"
        >
          🧭 {t.directions} ↗
        </a>
        <span className="text-[11px] text-slate-400">{t.stepHint}</span>
      </div>
    </div>
  );
}
