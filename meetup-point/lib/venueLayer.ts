/** Compact form of the venue list for the "all cafés & restaurants" map layer (~10k rows). */
import type { Venue } from './venues';

/** [id, lat, lng, 0 = café / 1 = restaurant, name, nameAr, cuisine] */
export type CompactVenue = [string, number, number, 0 | 1, string, string, string];

export function toCompact(v: Venue): CompactVenue {
  return [v.id, +v.location.lat.toFixed(5), +v.location.lng.toFixed(5), v.kind === 'cafe' ? 0 : 1, v.name, v.nameAr ?? '', v.cuisine ?? ''];
}

export function fromCompact(c: CompactVenue): Venue {
  return {
    id: c[0],
    location: { lat: c[1], lng: c[2] },
    kind: c[3] === 0 ? 'cafe' : 'restaurant',
    name: c[4],
    ...(c[5] ? { nameAr: c[5] } : {}),
    ...(c[6] ? { cuisine: c[6] } : {}),
  };
}
