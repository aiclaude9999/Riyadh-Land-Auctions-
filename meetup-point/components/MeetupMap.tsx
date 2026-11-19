'use client';

import { AdvancedMarker, APIProvider, Map, Pin, type MapMouseEvent } from '@vis.gl/react-google-maps';
import MetroLayer, { type MetroLineCollection } from './MetroLayer';
import { RIYADH_CENTER, type LatLng } from '@/lib/geo';
import { t } from '@/lib/i18n';
import type { StationCollection } from '@/lib/metro';
import { displayName, personColor, type Person } from '@/lib/people';

// Browser key only: restrict it to your site's referrer and the Maps JavaScript API.
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '';
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

interface Props {
  people: Person[];
  stationsGeoJson: StationCollection;
  linesGeoJson: MetroLineCollection;
  showMetro: boolean;
  onToggleMetro: () => void;
  pickingId: string | null;
  onMapPick: (location: LatLng) => void;
  onDragPerson: (id: string, location: LatLng) => void;
}

export default function MeetupMap(props: Props) {
  if (!BROWSER_KEY) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{t.mapNoKeyTitle}</p>
          <p className="mt-1">{t.mapNoKeyBody}</p>
        </div>
      </div>
    );
  }

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
      </Map>

      <label className="absolute end-3 top-3 z-10 flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm shadow">
        <input type="checkbox" checked={props.showMetro} onChange={props.onToggleMetro} className="accent-brand" />
        {t.metroLayer}
      </label>
      <p className="pointer-events-none absolute bottom-6 start-2 z-10 rounded bg-white/80 px-1.5 text-[11px] text-slate-600">{t.metroAttribution}</p>
    </APIProvider>
  );
}
