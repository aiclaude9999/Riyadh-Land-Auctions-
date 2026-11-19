import { haversineMeters, type LatLng } from './geo';

/** One line a station is on; `seq` = 0-based position along that line (used later for station counts). */
export interface StationLine {
  ref: string;
  name: string;
  color: string;
  seq: number;
}

export interface StationProps {
  id: string;
  name_en: string;
  name_ar: string;
  lines: StationLine[];
  interchange: boolean;
}

export interface StationFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: StationProps;
}

export interface StationCollection {
  type: 'FeatureCollection';
  metadata?: { source: string; license: string; generatedAt: string };
  features: StationFeature[];
}

export interface Station extends StationProps {
  position: LatLng;
}

export function toStations(fc: StationCollection): Station[] {
  return fc.features.map((f) => ({
    ...f.properties,
    position: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
  }));
}

/** The `n` stations nearest to `p`, closest first, with straight-line distance in metres. */
export function nearestStations(p: LatLng, stations: Station[], n = 3): { station: Station; meters: number }[] {
  return stations
    .map((station) => ({ station, meters: haversineMeters(p, station.position) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, n);
}
