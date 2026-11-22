'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect } from 'react';
import { venueGroups } from '@/lib/cuisine';
import { AdvancedMarker, APIProvider, Map, Pin, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps';
import MetroLayer, { type MetroLineCollection } from './MetroLayer';
import { RIYADH_CENTER, type LatLng } from '@/lib/geo';
import { useName, useT } from './LocaleProvider';
import type { StationCollection } from '@/lib/metro';
import { displayName, personColor, personInitial, type Person } from '@/lib/people';
import type { ScoredVenue } from '@/lib/scoring';
import type { FitTarget, Overlay } from '@/lib/overlays';
import type { Venue } from '@/lib/venues';
import { googleReviewsUrl } from '@/lib/directions';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

// Browser key only: restrict it to your site's referrer and the Maps JavaScript API.
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '';
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

// Free OpenStreetMap map, used when no Google browser key is set (Leaflet needs `window`, so no SSR).
const FreeMap = dynamic(() => import('./FreeMap'), { ssr: false, loading: () => <div className="h-full w-full bg-slate-100" /> });

export interface MapViewProps {
  people: Person[];
  stationsGeoJson: StationCollection;
  linesGeoJson: MetroLineCollection;
  showMetro: boolean;
  onToggleMetro: () => void;
  pickingId: string | null;
  onMapPick: (location: LatLng) => void;
  onDragPerson: (id: string, location: LatLng) => void;
  results: ScoredVenue[];
  /** Changes on every new search → the map zooms to show people + results. */
  resultsKey: string;
  selectedVenueId: string | null;
  onSelectVenue: (id: string) => void;
  /** Route lines for the selected place and the chosen neighbourhood outline. */
  overlays: Overlay[];
  /** Zoom target: a neighbourhood, one person's route, or one step. */
  fitTo: FitTarget | null;
  /** "All cafés & restaurants" layer (already filtered); null = not loaded */
  allVenues: Venue[] | null;
  showAllVenues: boolean;
  onToggleAllVenues: () => void;
  /** undefined = picking not allowed (e.g. a friend in a shared group) */
  onPickVenue?: (v: Venue) => void;
  /** px hidden at the bottom by the phone's pull-up panel (keep routes and credits above it) */
  insetBottom?: number;
}

/** Pop-up for a place on the "all places" layer (built as DOM so the button can call back). */
export function venuePopup(v: Venue, labels: { name: string; nameAr?: string; type: string; reviews: string; pick: string }, onPick?: (v: Venue) => void): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('dir', 'auto');
  el.style.cssText = 'font:13px system-ui,sans-serif;min-width:180px;max-width:240px';
  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.textContent = labels.name;
  el.appendChild(title);
  if (labels.nameAr && labels.nameAr !== labels.name) {
    const ar = document.createElement('div');
    ar.style.color = '#64748b';
    ar.textContent = labels.nameAr;
    el.appendChild(ar);
  }
  const type = document.createElement('div');
  type.style.cssText = 'color:#64748b;margin-top:2px';
  type.textContent = labels.type;
  el.appendChild(type);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const a = document.createElement('a');
  a.href = googleReviewsUrl(v.name, v.location, v.id.startsWith('g-') ? v.id.slice(2) : undefined);
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = `⭐ ${labels.reviews}`;
  a.style.cssText = 'color:#0f766e;text-decoration:none';
  row.appendChild(a);
  if (onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `📍 ${labels.pick}`;
    b.style.cssText = 'background:#0f766e;color:#fff;border:0;border-radius:6px;padding:3px 8px;cursor:pointer';
    b.onclick = () => onPick(v);
    row.appendChild(b);
  }
  el.appendChild(row);
  return el;
}

export const venueDotHtml = (kind: Venue['kind']) =>
  `<div style="width:12px;height:12px;border-radius:9999px;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);background:${kind === 'cafe' ? '#92400e' : '#ea580c'}"></div>`;

/** Numbered square marker for a ranked venue (shared look for both maps); rank 0 = the user's own pick (★). */
export function venueMarkerHtml(rank: number, selected: boolean): string {
  const size = selected ? 34 : 28;
  const bg = rank === 0 ? '#b45309' : rank === 1 ? '#0f766e' : '#334155';
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:8px;background:${bg};color:#fff;` +
    `display:flex;align-items:center;justify-content:center;font:700 ${selected ? 16 : 14}px system-ui,sans-serif;` +
    `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)${selected ? ',0 0 0 4px rgba(15,118,110,.35)' : ''}">${rank === 0 ? '★' : rank}</div>`
  );
}

/** Google map: draw overlays (routes with a white casing, dots, areas) and zoom to the current target. */
const insetBottomRef: { current: number } = { current: 0 };

function GoogleOverlays({ overlays, fitTo }: Pick<MapViewProps, 'overlays' | 'fitTo'>) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    type Shape = google.maps.Polyline | google.maps.Polygon | google.maps.Rectangle | google.maps.Marker;
    const shapes: Shape[] = overlays.flatMap((o): Shape[] =>
      o.kind === 'dot'
        ? [new google.maps.Marker({ map, position: o.at, title: o.label, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: o.color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 } })]
        : o.kind === 'line' && o.outline
          ? [new google.maps.Polyline({ map, path: o.points, strokeColor: '#ffffff', strokeWeight: o.weight + 4, strokeOpacity: 1, clickable: false, zIndex: 3 }), lineOf(map, o)]
          : [o.kind === 'line' ? lineOf(map, o) : shapeOf(map, o)],
    );
    return () => shapes.forEach((s) => s.setMap(null));
  }, [map, overlays]);
  useEffect(() => {
    if (!map || !fitTo?.points.length) return;
    if (fitTo.points.length === 1) {
      map.panTo(fitTo.points[0]);
      map.setZoom(17);
      return;
    }
    const b = new google.maps.LatLngBounds();
    fitTo.points.forEach((p) => b.extend(p));
    map.fitBounds(b, { top: 60, left: 50, right: 50, bottom: 130 + (insetBottomRef.current ?? 0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitTo?.key]);
  return null;
}

function shapeOf(map: google.maps.Map, o: Exclude<Overlay, { kind: 'line' } | { kind: 'dot' }>): google.maps.Polygon | google.maps.Rectangle {
  return o.kind === 'area'
    ? new google.maps.Polygon({ map, paths: o.rings.map((r) => r.map(([lat, lng]) => ({ lat, lng }))), strokeColor: o.color, strokeWeight: 2, fillColor: o.color, fillOpacity: 0.08, clickable: false })
    : new google.maps.Rectangle({ map, bounds: { south: o.south, west: o.west, north: o.north, east: o.east }, strokeWeight: 0, fillColor: o.color, fillOpacity: o.opacity, clickable: false });
}

function lineOf(map: google.maps.Map, o: Extract<Overlay, { kind: 'line' }>): google.maps.Polyline {
  return new google.maps.Polyline({
    map,
    path: o.points,
    strokeColor: o.color,
    strokeWeight: o.weight,
    strokeOpacity: o.dashed ? 0 : (o.opacity ?? 1),
    clickable: false,
    zIndex: o.dashed ? 5 : 4,
    // dashed line = repeated short dash symbols
    icons: o.dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: o.color, scale: o.weight }, offset: '0', repeat: '12px' }] : undefined,
  });
}

/** Google map: every café/restaurant as small dots, grouped into clusters. */
function GoogleVenues({ venues, show, onPick, labelsFor }: { venues: Venue[] | null; show: boolean; onPick?: (v: Venue) => void; labelsFor: (v: Venue) => Parameters<typeof venuePopup>[1] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !show || !venues) return;
    const info = new google.maps.InfoWindow();
    const markers = venues.map((v) => {
      const m = new google.maps.Marker({
        position: v.location,
        title: v.name,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: v.kind === 'cafe' ? '#92400e' : '#ea580c', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      });
      m.addListener('click', () => {
        info.setContent(venuePopup(v, labelsFor(v), onPick && ((x) => { info.close(); onPick(x); })));
        info.open({ map, anchor: m });
      });
      return m;
    });
    const clusterer = new MarkerClusterer({ map, markers });
    return () => {
      info.close();
      clusterer.clearMarkers();
      clusterer.setMap(null);
    };
  }, [map, venues, show, onPick, labelsFor]);
  return null;
}

/** Google map: fit people + results when a new search arrives; pan to the selected venue. */
function GoogleFit({ people, results, resultsKey, selectedVenueId }: Pick<MapViewProps, 'people' | 'results' | 'resultsKey' | 'selectedVenueId'>) {
  const map = useMap();
  useEffect(() => {
    if (!map || !resultsKey || !results.length) return;
    const b = new google.maps.LatLngBounds();
    people.forEach((p) => p.location && b.extend(p.location));
    results.forEach((r) => b.extend(r.venue.location));
    map.fitBounds(b, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, resultsKey]);
  useEffect(() => {
    const v = results.find((r) => r.venue.id === selectedVenueId);
    if (map && v && !map.getBounds()?.contains(v.venue.location)) map.panTo(v.venue.location);
  }, [map, selectedVenueId, results]);
  return null;
}

/** Labels for a place pop-up in the current language. */
export function useVenueLabels() {
  const t = useT();
  const n = useName();
  return useCallback(
    (v: Venue) => {
      const groups = venueGroups(v).map((g) => t.groups[g]);
      return {
        name: n(v.name, v.nameAr),
        nameAr: n(v.name, v.nameAr) === v.name ? v.nameAr : v.name,
        type: [t.venueTypes[v.kind], ...(groups.length ? [groups.join('، ')] : [])].join(' · '),
        reviews: t.reviews,
        pick: t.useAsMeetingPlace,
      };
    },
    [t, n],
  );
}

/** Layer switches in the map corner (same for both maps). The map is always LTR, so they sit on the right. */
export function MapToggles(props: Pick<MapViewProps, 'showMetro' | 'onToggleMetro' | 'showAllVenues' | 'onToggleAllVenues' | 'allVenues'>) {
  const t = useT();
  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-1.5">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm shadow">
        <input type="checkbox" checked={props.showMetro} onChange={props.onToggleMetro} className="accent-brand" />
        {t.metroLayer}
      </label>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm shadow">
        <input type="checkbox" checked={props.showAllVenues} onChange={props.onToggleAllVenues} className="accent-brand" />
        🍽 {t.allVenuesLayer}
        {props.showAllVenues && props.allVenues && <span className="text-xs text-slate-500">({props.allVenues.length.toLocaleString('en')})</span>}
        {props.showAllVenues && !props.allVenues && <span className="text-xs text-slate-500">{t.loadingVenues}</span>}
      </label>
    </div>
  );
}

export default function MeetupMap(props: MapViewProps) {
  const t = useT();
  const labelsFor = useVenueLabels();
  insetBottomRef.current = props.insetBottom ?? 0;
  if (!BROWSER_KEY) return <FreeMap {...props} />;

  const { people, pickingId } = props;
  const picking = pickingId !== null;

  return (
    <APIProvider apiKey={BROWSER_KEY} language="en" region="SA">
      <Map
        className="h-full w-full"
        mapId={MAP_ID}
        defaultCenter={RIYADH_CENTER}
        defaultZoom={11}
        minZoom={9}
        gestureHandling="greedy"
        clickableIcons={false}
        streetViewControl={false}
        mapTypeControl={false}
        draggableCursor={picking ? 'crosshair' : undefined}
        onClick={(e: MapMouseEvent) => {
          const ll = e.detail.latLng;
          if (picking && ll) props.onMapPick({ lat: ll.lat, lng: ll.lng });
        }}
      >
        <MetroLayer stations={props.stationsGeoJson} lines={props.linesGeoJson} visible={props.showMetro} clickable={!picking} />

        {people.map((p, i) =>
          p.location ? (
            <AdvancedMarker
              key={p.id}
              position={p.location}
              title={displayName(p, i, t.namePlaceholder)}
              draggable
              zIndex={100 + i}
              onDragEnd={(e) => {
                const ll = e.latLng;
                if (ll) props.onDragPerson(p.id, { lat: ll.lat(), lng: ll.lng() });
              }}
            >
              <Pin background={personColor(i)} borderColor="#ffffff" glyphColor="#ffffff" glyph={personInitial(p, i)} />
            </AdvancedMarker>
          ) : null,
        )}

        {props.results.map((r) => (
          <AdvancedMarker
            key={r.venue.id}
            position={r.venue.location}
            title={`${r.rank}. ${r.venue.name}`}
            zIndex={r.venue.id === props.selectedVenueId ? 300 : 200 - r.rank}
            onClick={() => props.onSelectVenue(r.venue.id)}
          >
            <div dangerouslySetInnerHTML={{ __html: venueMarkerHtml(r.rank, r.venue.id === props.selectedVenueId) }} />
          </AdvancedMarker>
        ))}
        <GoogleOverlays overlays={props.overlays} fitTo={props.fitTo} />
        <GoogleVenues venues={props.allVenues} show={props.showAllVenues} onPick={props.onPickVenue} labelsFor={labelsFor} />
        <GoogleFit people={people} results={props.results} resultsKey={props.resultsKey} selectedVenueId={props.selectedVenueId} />
      </Map>

      <MapToggles {...props} />
      <p className="pointer-events-none absolute bottom-6 left-2 z-10 rounded bg-white/80 px-1.5 text-xs text-slate-600">{t.metroAttribution}</p>
    </APIProvider>
  );
}
