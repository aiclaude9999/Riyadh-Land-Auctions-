/**
 * Server-side Google calls. Import ONLY from route handlers: this reads the unrestricted
 * server key (GOOGLE_MAPS_API_KEY), which must never reach the browser.
 */
import { RIYADH_BOUNDS } from './geo';

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
