export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough bounding box of Riyadh city, used to bias address search and to sanity-check pins. */
export const RIYADH_BOUNDS = { south: 24.4, west: 46.4, north: 25.05, east: 47.05 } as const;
export const RIYADH_CENTER: LatLng = { lat: 24.7136, lng: 46.6753 };

export function inRiyadh(p: LatLng): boolean {
  return p.lat >= RIYADH_BOUNDS.south && p.lat <= RIYADH_BOUNDS.north && p.lng >= RIYADH_BOUNDS.west && p.lng <= RIYADH_BOUNDS.east;
}
