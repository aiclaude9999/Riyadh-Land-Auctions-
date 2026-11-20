'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { AdvancedMarker, APIProvider, Map, Pin, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps';
import MetroLayer, { type MetroLineCollection } from './MetroLayer';
import { RIYADH_CENTER, type LatLng } from '@/lib/geo';
import { t } from '@/lib/i18n';
import type { StationCollection } from '@/lib/metro';
import { displayName, personColor, type Person } from '@/lib/people';
import type { ScoredVenue } from '@/lib/scoring';
import type { Overlay } from '@/lib/overlays';

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
  /** When set (a neighbourhood was chosen), the map zooms to these rings. */
  focusBounds: [number, number][][] | null;
}

/** Numbered square marker for a ranked venue (shared look for both maps). */
export function venueMarkerHtml(rank: number, selected: boolean): string {
  const size = selected ? 34 : 28;
  const bg = rank === 1 ? '#0f766e' : '#334155';
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:8px;background:${bg};color:#fff;` +
    `display:flex;align-items:center;justify-content:center;font:700 ${selected ? 16 : 14}px system-ui,sans-serif;` +
    `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)${selected ? ',0 0 0 4px rgba(15,118,110,.35)' : ''}">${rank}</div>`
  );
}

/** Google map: draw overlays as Polylines / Polygons; zoom to a chosen neighbourhood. */
function GoogleOverlays({ overlays, focusBounds }: Pick<MapViewProps, 'overlays' | 'focusBounds'>) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const shapes: (google.maps.Polyline | google.maps.Polygon)[] = overlays.map((o) =>
      o.kind === 'area'
        ? new google.maps.Polygon({ map, paths: o.rings.map((r) => r.map(([lat, lng]) => ({ lat, lng }))), strokeColor: o.color, strokeWeight: 2, fillColor: o.color, fillOpacity: 0.08, clickable: false })
        : new google.maps.Polyline({
            map,
            path: o.points,
            strokeColor: o.color,
            strokeWeight: o.weight,
            strokeOpacity: o.dashed ? 0 : (o.opacity ?? 1),
            clickable: false,
            zIndex: o.dashed ? 5 : 4,
            // dashed line = repeated short dash symbols
            icons: o.dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: o.color, scale: o.weight }, offset: '0', repeat: '12px' }] : undefined,
          }),
    );
    return () => shapes.forEach((s) => s.setMap(null));
  }, [map, overlays]);
  useEffect(() => {
    if (!map || !focusBounds?.length) return;
    const b = new google.maps.LatLngBounds();
    focusBounds.forEach((r) => r.forEach(([lat, lng]) => b.extend({ lat, lng })));
    map.fitBounds(b, 40);
  }, [map, focusBounds]);
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

export default function MeetupMap(props: MapViewProps) {
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
              title={displayName(p, i)}
              draggable
              zIndex={100 + i}
              onDragEnd={(e) => {
                const ll = e.latLng;
                if (ll) props.onDragPerson(p.id, { lat: ll.lat(), lng: ll.lng() });
              }}
            >
              <Pin background={personColor(i)} borderColor="#ffffff" glyphColor="#ffffff" glyph={(displayName(p, i)[0] ?? '?').toUpperCase()} />
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
        <GoogleOverlays overlays={props.overlays} focusBounds={props.focusBounds} />
        <GoogleFit people={people} results={props.results} resultsKey={props.resultsKey} selectedVenueId={props.selectedVenueId} />
      </Map>

      <label className="absolute end-3 top-3 z-10 flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm shadow">
        <input type="checkbox" checked={props.showMetro} onChange={props.onToggleMetro} className="accent-brand" />
        {t.metroLayer}
      </label>
      <p className="pointer-events-none absolute bottom-6 start-2 z-10 rounded bg-white/80 px-1.5 text-[11px] text-slate-600">{t.metroAttribution}</p>
    </APIProvider>
  );
}
