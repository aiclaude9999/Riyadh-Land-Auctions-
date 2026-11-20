'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { venueMarkerHtml, type MapViewProps } from './MeetupMap';
import { RIYADH_BOUNDS, RIYADH_CENTER } from '@/lib/geo';
import { t } from '@/lib/i18n';
import { displayName, personColor } from '@/lib/people';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function personIcon(color: string, letter: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    html:
      `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="M15 37C15 37 28 23.5 28 14A13 13 0 0 0 2 14C2 23.5 15 37 15 37Z" fill="${color}" stroke="#fff" stroke-width="2"/>` +
      `<text x="15" y="18.5" text-anchor="middle" font-size="12" font-weight="700" font-family="system-ui,sans-serif" fill="#fff">${escapeHtml(letter)}</text></svg>`,
  });
}

/**
 * Free map (no Google key needed): Leaflet + OpenStreetMap tiles. Used when
 * NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set; same props as the Google map.
 * OSM's tile policy allows light use like this prototype; a busy public site needs its own tile provider.
 */
export default function FreeMap(props: MapViewProps) {
  const { people, pickingId, showMetro, stationsGeoJson, linesGeoJson, results, resultsKey, selectedVenueId } = props;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const metroRef = useRef<L.LayerGroup | null>(null);
  const peopleRef = useRef<L.LayerGroup | null>(null);
  const venuesRef = useRef<L.LayerGroup | null>(null);
  // latest callbacks without re-binding map listeners
  const cb = useRef(props);
  cb.current = props;

  // create the map once
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, {
      center: [RIYADH_CENTER.lat, RIYADH_CENTER.lng],
      zoom: 11,
      minZoom: 9,
      maxBounds: L.latLngBounds([RIYADH_BOUNDS.south - 0.5, RIYADH_BOUNDS.west - 0.5], [RIYADH_BOUNDS.north + 0.5, RIYADH_BOUNDS.east + 0.5]),
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (cb.current.pickingId) cb.current.onMapPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    peopleRef.current = L.layerGroup().addTo(map);
    venuesRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // metro lines + stations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup();
    for (const f of linesGeoJson.features) {
      L.polyline(
        f.geometry.coordinates.map((path) => path.map(([lng, lat]) => [lat, lng] as [number, number])),
        { color: f.properties.color, weight: 4, opacity: 0.85, interactive: false },
      ).addTo(group);
    }
    for (const f of stationsGeoJson.features) {
      const s = f.properties;
      const interchange = s.lines.length > 1;
      const chips = s.lines
        .map((l) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-inline-end:8px"><span style="width:10px;height:10px;border-radius:9999px;background:${escapeHtml(l.color)}"></span>${escapeHtml(l.name)}</span>`)
        .join('');
      L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
        radius: interchange ? 6 : 4.5,
        color: interchange ? '#0f172a' : (s.lines[0]?.color ?? '#334155'),
        weight: interchange ? 2.5 : 2,
        fillColor: '#ffffff',
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
        .bindTooltip(escapeHtml(s.name_en))
        .bindPopup(
          `<div style="font:13px system-ui,sans-serif;min-width:160px"><div style="font-weight:600">${escapeHtml(s.name_en)}</div>` +
            (s.name_ar ? `<div dir="rtl" style="color:#64748b">${escapeHtml(s.name_ar)}</div>` : '') +
            `<div style="margin-top:6px">${chips}</div>` +
            (interchange ? `<div style="margin-top:4px;color:#0f766e">${escapeHtml(t.interchange)}</div>` : '') +
            `</div>`,
        )
        .on('click', (e) => {
          // while picking, a click on a station sets the person's location there instead of opening the popup
          if (cb.current.pickingId) {
            e.target.closePopup();
            cb.current.onMapPick({ lat: e.latlng.lat, lng: e.latlng.lng });
          }
        })
        .addTo(group);
    }
    metroRef.current = group;
    return () => {
      group.remove();
      metroRef.current = null;
    };
  }, [stationsGeoJson, linesGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const group = metroRef.current;
    if (!map || !group) return;
    if (showMetro) group.addTo(map);
    else group.remove();
  }, [showMetro, stationsGeoJson, linesGeoJson]);

  // person pins (draggable)
  useEffect(() => {
    const group = peopleRef.current;
    if (!group) return;
    group.clearLayers();
    people.forEach((p, i) => {
      if (!p.location) return;
      const name = displayName(p, i);
      L.marker([p.location.lat, p.location.lng], {
        draggable: true,
        title: name,
        zIndexOffset: 1000 + i,
        icon: personIcon(personColor(i), (name[0] ?? '?').toUpperCase()),
      })
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          cb.current.onDragPerson(p.id, { lat: ll.lat, lng: ll.lng });
        })
        .addTo(group);
    });
  }, [people]);

  // ranked venues (numbered squares); click selects
  useEffect(() => {
    const group = venuesRef.current;
    if (!group) return;
    group.clearLayers();
    for (const r of results) {
      const selected = r.venue.id === selectedVenueId;
      const size = selected ? 34 : 28;
      L.marker([r.venue.location.lat, r.venue.location.lng], {
        title: `${r.rank}. ${r.venue.name}`,
        zIndexOffset: selected ? 3000 : 2000 - r.rank,
        icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: venueMarkerHtml(r.rank, selected) }),
      })
        .on('click', () => cb.current.onSelectVenue(r.venue.id))
        .addTo(group);
    }
  }, [results, selectedVenueId]);

  // new search → show everyone and every result
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !resultsKey || !results.length) return;
    const pts = [...people.flatMap((p) => (p.location ? [[p.location.lat, p.location.lng] as [number, number]] : [])), ...results.map((r) => [r.venue.location.lat, r.venue.location.lng] as [number, number])];
    map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey]);

  // keep the selected venue in view
  useEffect(() => {
    const map = mapRef.current;
    const v = results.find((r) => r.venue.id === selectedVenueId);
    if (map && v && !map.getBounds().contains([v.venue.location.lat, v.venue.location.lng])) map.panTo([v.venue.location.lat, v.venue.location.lng]);
  }, [selectedVenueId, results]);

  // crosshair while picking
  useEffect(() => {
    const c = mapRef.current?.getContainer();
    if (c) c.style.cursor = pickingId ? 'crosshair' : '';
  }, [pickingId]);

  return (
    <>
      <div ref={el} className="h-full w-full" />
      <label className="absolute end-3 top-3 z-[1000] flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm shadow">
        <input type="checkbox" checked={showMetro} onChange={props.onToggleMetro} className="accent-brand" />
        {t.metroLayer}
      </label>
      <p className="pointer-events-none absolute bottom-6 start-2 z-[1000] rounded bg-white/80 px-1.5 text-[11px] text-slate-600">{t.metroAttribution}</p>
    </>
  );
}
