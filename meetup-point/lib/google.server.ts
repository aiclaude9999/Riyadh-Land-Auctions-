/**
 * Server-side Google calls. Import ONLY from route handlers: this reads the unrestricted
 * server key (GOOGLE_MAPS_API_KEY), which must never reach the browser.
 */
import { RIYADH_BOUNDS, type LatLng as Pt } from './geo';
import type { Venue, VenueType } from './venues';

export class MissingKeyError extends Error {
  constructor() {
    super('GOOGLE_MAPS_API_KEY is not set');
  }
}

function serverKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new MissingKeyError();
  return key;
}

export interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

export interface PlaceLocation {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
}

/** Places API (New) Autocomplete, biased to Riyadh and limited to Saudi Arabia. */
export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': serverKey() },
    body: JSON.stringify({
      input,
      sessionToken,
      languageCode: 'en',
      includedRegionCodes: ['sa'],
      locationBias: {
        rectangle: {
          low: { latitude: RIYADH_BOUNDS.south, longitude: RIYADH_BOUNDS.west },
          high: { latitude: RIYADH_BOUNDS.north, longitude: RIYADH_BOUNDS.east },
        },
      },
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Places autocomplete: HTTP ${res.status}`);
  const data = (await res.json()) as {
    suggestions?: { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

/** Place Details (New) — only the fields we need (id, name, address, location) to keep the SKU cheap. */
export async function placeLocation(placeId: string, sessionToken: string): Promise<PlaceLocation> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'en');
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': serverKey(), 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Place details: HTTP ${res.status}`);
  const p = (await res.json()) as { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } };
  if (!p.location) throw new Error('Place has no location');
  return {
    placeId: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    location: { lat: p.location.latitude, lng: p.location.longitude },
  };
}

// ---------------------------------------------------------------------------------------------
// Step 3: candidates (Places searchNearby) and travel times (Routes computeRouteMatrix).


interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  currentOpeningHours?: { openNow?: boolean };
}

/** Places → Venues, dropping closed places and rating < minRating (unrated places are dropped too). */
export function parsePlaces(places: GPlace[], opts: { minRating: number; requireOpenNow: boolean }): Venue[] {
  return places
    .filter((p) => p.location && p.displayName?.text)
    .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
    .filter((p) => !opts.requireOpenNow || p.currentOpeningHours?.openNow !== false)
    .filter((p) => (p.rating ?? 0) >= opts.minRating)
    .map((p) => ({
      id: `g-${p.id}`,
      name: p.displayName!.text,
      kind: p.primaryType === 'cafe' || (p.types?.includes('cafe') && !p.types?.includes('restaurant')) ? ('cafe' as const) : ('restaurant' as const),
      location: { lat: p.location!.latitude, lng: p.location!.longitude },
      ...(p.formattedAddress ? { address: p.formattedAddress } : {}),
      ...(p.rating != null ? { rating: p.rating } : {}),
      ...(p.userRatingCount != null ? { ratingCount: p.userRatingCount } : {}),
    }));
}

export async function searchNearby(center: Pt, radiusM: number, type: VenueType): Promise<GPlace[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': serverKey(),
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.types,places.currentOpeningHours.openNow',
    },
    body: JSON.stringify({
      includedTypes: type === 'both' ? ['cafe', 'restaurant'] : [type],
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      languageCode: 'en',
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(radiusM, 50_000) } },
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Places searchNearby: HTTP ${res.status}`);
  return ((await res.json()) as { places?: GPlace[] }).places ?? [];
}

type MatrixElement = { originIndex?: number; destinationIndex?: number; duration?: string; condition?: string };

/** Parses computeRouteMatrix output into minutes[origin][destination] (null = no route). */
export function parseRouteMatrix(elements: MatrixElement[], origins: number, destinations: number): (number | null)[][] {
  const out: (number | null)[][] = Array.from({ length: origins }, () => new Array<number | null>(destinations).fill(null));
  for (const e of elements) {
    if (e.condition !== 'ROUTE_EXISTS' || !e.duration) continue;
    out[e.originIndex ?? 0][e.destinationIndex ?? 0] = parseFloat(e.duration) / 60; // "123s"
  }
  return out;
}

/** DRIVE (traffic-aware) or TRANSIT minutes. Splits destinations so each call stays ≤ 100 elements. */
export async function routeMatrix(mode: 'DRIVE' | 'TRANSIT', origins: Pt[], destinations: Pt[], departAt?: string): Promise<(number | null)[][]> {
  const wp = (p: Pt) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
  const chunk = Math.max(1, Math.floor(100 / origins.length));
  const out: (number | null)[][] = origins.map(() => []);
  for (let start = 0; start < destinations.length; start += chunk) {
    const part = destinations.slice(start, start + chunk);
    const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': serverKey(), 'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition' },
      body: JSON.stringify({
        origins: origins.map(wp),
        destinations: part.map(wp),
        travelMode: mode,
        ...(mode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
        ...(departAt ? { departureTime: departAt } : {}),
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Route matrix ${mode}: HTTP ${res.status}`);
    const m = parseRouteMatrix((await res.json()) as MatrixElement[], origins.length, part.length);
    m.forEach((row, i) => out[i].push(...row));
  }
  return out;
}

export function hasServerKey(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}
