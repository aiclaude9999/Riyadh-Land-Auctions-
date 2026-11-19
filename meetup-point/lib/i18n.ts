/**
 * UI strings. English first; add an `ar` dictionary later and switch `dir` to "rtl".
 * Components use logical Tailwind classes (ms-/me-/ps-/pe-/start-/end-) so RTL works without rewrites.
 */
export const en = {
  appTitle: 'Riyadh Meetup Point',
  appTagline: 'Find the fairest café or restaurant for your group.',
  people: 'People',
  peopleCount: (n: number, max: number) => `${n} of ${max}`,
  addPerson: 'Add person',
  removePerson: 'Remove',
  namePlaceholder: (n: number) => `Person ${n}`,
  nameLabel: 'Name',
  modeLabel: 'Travel mode',
  car: 'Car',
  metro: 'Metro',
  locationLabel: 'Starting point',
  searchPlaceholder: 'Search an address or place',
  pickOnMap: 'Pick on map',
  picking: 'Click the map…',
  pinnedOnMap: 'Pinned on map',
  clearLocation: 'Clear',
  missingLocation: 'Needs a starting point',
  outsideRiyadh: 'This point is outside Riyadh — results may be poor.',
  nearestStation: (name: string, km: string) => `Nearest metro: ${name} (${km} km straight line)`,
  pickBanner: (name: string) => `Click the map to set ${name}'s starting point`,
  cancel: 'Cancel',
  dragHint: 'Tip: drag a pin to fine-tune it.',
  readyCount: (ready: number, total: number) => `${ready} of ${total} people have a starting point`,
  nextStepNote: 'Departure time, venue type and “Find meeting point” come in the next build step.',
  metroLayer: 'Metro lines',
  searchNoKey: 'Address search is off: GOOGLE_MAPS_API_KEY is not set on the server. Use “Pick on map”.',
  searchError: 'Search failed. Try again or use “Pick on map”.',
  noResults: 'No matches',
  mapNoKeyTitle: 'Map needs a browser key',
  mapNoKeyBody: 'Add NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to .env.local (see .env.example), then restart `npm run dev`.',
  metroAttribution: 'Metro data © OpenStreetMap contributors (ODbL)',
  lines: 'Lines',
  interchange: 'Interchange',
};

export type Strings = typeof en;
export const t: Strings = en;
export const locale = { lang: 'en', dir: 'ltr' as 'ltr' | 'rtl' };
