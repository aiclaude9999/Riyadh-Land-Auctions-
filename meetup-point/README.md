# Riyadh Meetup Point (prototype)

Picks the fairest café or restaurant for 2–6 people in Riyadh, by car or metro.
Spec and build order: [`CLAUDE.md`](./CLAUDE.md). This folder is a separate app; it has nothing to do with Mazad Radar's deploy.

**Built so far:** step 1 (scaffold + map with the metro layer) and step 2 (people input panel).

## Run it on your computer

1. Install Node.js 22 (nodejs.org → "LTS").
2. In a terminal: `cd meetup-point` → `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the keys (see below).
4. `npm run dev` → open http://localhost:3000

Without keys the app still opens: the map area shows a notice and the address search says it is off.

## Google keys (two separate keys)

Google Cloud Console → pick or create a project:

1. **APIs & Services → Library**, then enable **Maps JavaScript API**, **Places API (New)** and **Routes API** (Routes is used from step 3 on).
2. **APIs & Services → Credentials → Create credentials → API key**, twice:
   - **Browser key** → `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`. Under *Application restrictions* pick **Websites** and add `http://localhost:3000/*`. Under *API restrictions*, allow only **Maps JavaScript API**.
   - **Server key** → `GOOGLE_MAPS_API_KEY`. Under *API restrictions*, allow only **Places API (New)** and **Routes API**. This key stays on the server; the browser never sees it.
3. Cost: Google needs a billing account. Each API includes a monthly free usage allowance. To stay at zero, go to **APIs & Services → each API → Quotas** and set low daily caps, and add a budget alert under **Billing → Budgets & alerts**.

## Commands

- `npm test`: unit tests (vitest)
- `npm run typecheck`
- `npm run build:metro`: rebuilds `data/metro-stations.geojson` + `data/metro-lines.geojson` from OpenStreetMap

## Metro data

The spec names the RCRC open data portal. In Nov 2026 the portal (`rcrc.opendatasoft.com`, now `opendata.rcrc.gov.sa`) answers "domain could not be found", so the data comes from **OpenStreetMap** (ODbL; the attribution is shown on the map). It has 6 lines, 82 stations and 10 interchanges.
Each station has `name_en`, `name_ar` (empty when OSM has no real Arabic name), `lines[]` (`ref`, `name`, `color`, `seq` = position along the line) and `interchange`.
If RCRC comes back, map its export to the same shape (`lib/metro.ts`).

## Code map

- `app/page.tsx`: reads the metro GeoJSON on the server and renders `components/MeetupApp.tsx` (state + layout)
- `components/MeetupMap.tsx`: Google map, person pins (draggable), metro toggle; `MetroLayer.tsx` draws lines + stations
- `components/PeoplePanel.tsx`, `PersonCard.tsx`, `PlaceSearch.tsx`: people input (name, car/metro, search or pick on map)
- `app/api/places/*`: server-side Places autocomplete + details (10-min in-memory cache, `lib/cache.ts`)
- `lib/people.ts` (pure state + rules), `lib/metro.ts`, `lib/geo.ts`, `lib/i18n.ts` (English strings, RTL-ready)
