'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { useName, useT } from './LocaleProvider';
import type { StationCollection, StationLine } from '@/lib/metro';

export interface MetroLineCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
    properties: { ref: string; name: string; color: string };
  }[];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Draws metro lines + stations with a google.maps.Data layer (one per layer so it can be toggled
 * without touching map.data). Clicking a station opens an info window with its lines.
 */
export default function MetroLayer({ stations, lines, visible, clickable }: { stations: StationCollection; lines: MetroLineCollection; visible: boolean; clickable: boolean }) {
  const t = useT();
  const n = useName();
  const map = useMap();
  const layerRef = useRef<google.maps.Data | null>(null);

  useEffect(() => {
    if (!map) return;
    const layer = new google.maps.Data();
    layer.addGeoJson(lines);
    layer.addGeoJson(stations);
    const info = new google.maps.InfoWindow();

    const listener = layer.addListener('click', (e: google.maps.Data.MouseEvent) => {
      if (e.feature.getGeometry()?.getType() !== 'Point') return;
      const enName = String(e.feature.getProperty('name_en') ?? '');
      const arName = String(e.feature.getProperty('name_ar') ?? '');
      const name = n(enName, arName);
      const nameAr = name === arName ? enName : arName;
      const stLines = (e.feature.getProperty('lines') ?? []) as StationLine[];
      const chips = stLines
        .map((l) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-inline-end:8px"><span style="width:10px;height:10px;border-radius:9999px;background:${escapeHtml(l.color)}"></span>${escapeHtml(t.lineNames[l.ref] ?? l.name)}</span>`)
        .join('');
      info.setContent(
        `<div style="font:13px system-ui,sans-serif;min-width:160px">` +
          `<div style="font-weight:600">${escapeHtml(name)}</div>` +
          (nameAr && nameAr !== name ? `<div dir="auto" style="color:#64748b">${escapeHtml(nameAr)}</div>` : '') +
          `<div style="margin-top:6px">${chips}</div>` +
          (stLines.length > 1 ? `<div style="margin-top:4px;color:#0f766e">${escapeHtml(t.interchange)}</div>` : '') +
          `</div>`,
      );
      info.setPosition(e.latLng);
      info.open({ map });
    });

    layerRef.current = layer;
    return () => {
      listener.remove();
      info.close();
      layer.setMap(null);
      layerRef.current = null;
    };
  }, [map, stations, lines, t, n]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !map) return;
    layer.setStyle((f) => {
      if (f.getGeometry()?.getType() === 'Point') {
        const stLines = (f.getProperty('lines') ?? []) as StationLine[];
        const interchange = stLines.length > 1;
        return {
          clickable,
          zIndex: interchange ? 3 : 2,
          title: n(String(f.getProperty('name_en') ?? ''), String(f.getProperty('name_ar') ?? '')),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: interchange ? 6 : 4.5,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: interchange ? '#0f172a' : (stLines[0]?.color ?? '#334155'),
            strokeWeight: interchange ? 2.5 : 2,
          },
        };
      }
      return { clickable: false, strokeColor: String(f.getProperty('color') ?? '#555'), strokeWeight: 4, strokeOpacity: 0.85, zIndex: 1 };
    });
    layer.setMap(visible ? map : null);
  }, [map, visible, clickable, stations, lines, n]);

  return null;
}
