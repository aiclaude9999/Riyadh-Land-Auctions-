'use client';

import { useState } from 'react';
import { googleDirectionsUrl, type CarRoute } from '@/lib/directions';
import type { MetroLeg } from '@/lib/estimator';
import type { LatLng } from '@/lib/geo';
import { useName, useT } from './LocaleProvider';
import type { ScoredEta } from '@/lib/scoring';

export type RouteState = CarRoute | 'loading' | 'error' | undefined;

const fmt = (m: number) => String(Math.max(1, Math.round(m)));

function MetroSteps({ legs }: { legs: MetroLeg[] }) {
  const t = useT();
  const n = useName();
  const items: { icon: React.ReactNode; text: string; sub?: string }[] = [];
  const walkAll = legs.length === 1 && legs[0].kind === 'walk';
  for (const l of legs) {
    if (l.kind === 'walk') {
      items.push({ icon: '🚶', text: walkAll ? t.stepWalkAll(fmt(l.minutes)) : l.to === 'station' ? t.stepWalkToStation(fmt(l.minutes), n(l.station ?? '', l.stationAr)) : t.stepWalkToVenue(fmt(l.minutes)) });
    } else if (l.kind === 'wait') {
      items.push({ icon: '⏱', text: t.stepWait(fmt(l.minutes)) });
    } else if (l.kind === 'transfer') {
      items.push({ icon: '🔁', text: t.stepTransfer(n(l.at, l.atAr), t.lineNames[l.toLineRef] ?? l.toLine) });
    } else {
      items.push({
        icon: <span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: l.color }} />,
        text: t.stepRide(t.lineNames[l.line] ?? l.lineName, n(l.toward, l.towardAr), l.stops),
        sub: `${t.stepGetOff(n(l.to, l.toAr))} · ~${t.minutes(l.minutes)}`,
      });
    }
  }
  return (
    <ol className="mt-1 space-y-1 border-s-2 border-slate-200 ps-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-xs text-slate-700">
          <span className="w-4 shrink-0 text-center" aria-hidden>
            {it.icon}
          </span>
          <span>
            {it.text}
            {it.sub && <span className="block text-slate-500">{it.sub}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CarSteps({ route }: { route: RouteState }) {
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
      {open && <ol className="mt-1 space-y-1 border-s-2 border-slate-200 ps-3">
        {route.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-xs text-slate-700">
            <span className="w-4 shrink-0 text-center text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1">{t.carStep(s)}</span>
            {s.meters > 0 && <span className="shrink-0 tabular-nums text-slate-400">{t.distance(s.meters)}</span>}
          </li>
        ))}
      </ol>}
    </>
  );
}

/** One person's trip: steps (metro legs or car turns) + a button to open real directions in Google Maps. */
export default function TripDetails({ eta, from, to, route }: { eta: ScoredEta; from: LatLng; to: LatLng; route: RouteState }) {
  const t = useT();
  return (
    <div className="mt-1">
      {eta.mode === 'metro' ? eta.detail?.legs ? <MetroSteps legs={eta.detail.legs} /> : null : <CarSteps route={route} />}
      <a
        href={googleDirectionsUrl(from, to, eta.mode)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-brand hover:text-brand"
      >
        🧭 {t.directions} ↗
      </a>
    </div>
  );
}
