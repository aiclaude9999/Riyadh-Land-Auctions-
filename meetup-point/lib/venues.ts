import type { LatLng } from './geo';

export type VenueKind = 'cafe' | 'restaurant';
export type VenueType = VenueKind | 'both';

export interface Venue {
  id: string;
  name: string;
  nameAr?: string;
  kind: VenueKind;
  location: LatLng;
  address?: string;
  rating?: number;
  ratingCount?: number;
  cuisine?: string;
  openingHours?: string;
  brand?: string;
}

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const r5 = (x: number) => +x.toFixed(5);

/** Overpass JSON (amenity=cafe|restaurant with a name) → compact Venue list. */
export function parseOverpass(json: { elements?: OsmElement[] }): Venue[] {
  const out: Venue[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const kind = tags.amenity;
    if (kind !== 'cafe' && kind !== 'restaurant') continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = (tags['name:en'] ?? tags.name ?? '').trim();
    if (lat == null || lon == null || !name) continue;
    if (tags.disused === 'yes' || tags.opening_hours === 'closed' || tags['abandoned:amenity']) continue;
    const nameAr = tags['name:ar'] ?? (/[؀-ۿ]/.test(tags.name ?? '') ? tags.name : undefined);
    const street = [tags['addr:street'], tags['addr:suburb'] ?? tags['addr:district']].filter(Boolean).join(', ');
    out.push({
      id: `osm-${el.type[0]}${el.id}`,
      name,
      ...(nameAr && nameAr !== name ? { nameAr } : {}),
      kind,
      location: { lat: r5(lat), lng: r5(lon) },
      ...(street ? { address: street } : {}),
      ...(tags.cuisine ? { cuisine: tags.cuisine.replace(/_/g, ' ').replace(/;/g, ', ') } : {}),
      ...(tags.opening_hours ? { openingHours: tags.opening_hours } : {}),
      ...(tags.brand ? { brand: tags.brand } : {}),
    });
  }
  return out;
}

export function matchesType(v: Venue, type: VenueType): boolean {
  return type === 'both' || v.kind === type;
}
