# Riyadh Meetup Point (prototype)

Picks the fairest café or restaurant for 2–6 people in Riyadh, by car or metro.
Spec and build order: [`CLAUDE.md`](./CLAUDE.md). This folder is a separate app; it has nothing to do with Mazad Radar's deploy.

**Built so far:** steps 1–5: map + metro layer, people panel, `/api/recommend` (candidates → travel times → scoring), results list + numbered map markers + ETA breakdown, and the metro fallback estimator with tests. Step 6 (polish) is not started.

**Step 6 + "smarter results" (Nov 2026):** day + time-of-day slider; in free mode car times get a *typical traffic* factor per hour (TomTom Traffic Index 2025 averages for Riyadh, `lib/timing.ts`); warnings when the group arrives around a prayer time (`adhan`, Umm al-Qura) or a metro trip falls outside the usual hours (Sat–Thu 6:00–24:00, Fri from 10:00 — not confirmed with the operator, adjust `METRO_HOURS`); "everyone within X min" zone (9×9 grid, approximate); filters: near a metro station, food group.

**Extras (Nov 2026, "easier to use" batch):** neighbourhood list (189 Riyadh districts, English/Arabic search, tap to refine), step-by-step trip per person (metro lines, direction, changes; car turns + route line from OSRM), Google Maps *Directions* and *Reviews* links, and *Preferences* (liked/avoided food, favourite and hidden places), saved only in the browser.

**Free mode vs Google mode** (chosen automatically):
| | Free (no keys) | Google (`GOOGLE_MAPS_API_KEY` set) |
|---|---|---|
| Places | `data/venues-riyadh.json`: 668 named cafés/restaurants from OpenStreetMap, no ratings | Places API (New) `searchNearby`, closed / rating < 3.8 dropped |
| Car times | OSRM public server (OSM roads, **no live traffic**); local estimate if it is down | Routes `computeRouteMatrix` DRIVE, TRAFFIC_AWARE |
| Metro times | local estimate (spec "Fallback"), marked *est.* | Routes TRANSIT; missing routes use the local estimate |

Google mode is written to the documented API shapes and unit-tested with fakes, but has **not** been run against Google yet (no key).

**Heat penalty:** the spec says "+1.5× walking minutes". It is implemented as *walking minutes count 1.5×*, so a metro user's walking adds 0.5× on top of the trip time (`heatFactor` in `lib/scoring.ts`).

## Run it on your computer

**Windows, easiest:** open the `meetup-point` folder and double-click `start-windows.bat`. Keep the black window open; the browser opens at http://localhost:3000.

Manual steps:

1. Install Node.js 22 (nodejs.org → "LTS").
2. In a terminal: `cd meetup-point` → `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the keys (see below).
4. `npm run dev` → open http://localhost:3000

**No keys needed to try it:** without a Google browser key the app uses a free OpenStreetMap map (Leaflet), with metro lines, pin-on-map and draggable pins. Only the address search needs the server key. Add the Google browser key later to switch to the Google map.

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
- `npm run build:venues`: rebuilds `data/venues-riyadh.json` from OpenStreetMap (Overpass; `-- --from saved.json` to convert a saved reply)
- `npm run build:metro`: rebuilds `data/metro-stations.geojson` + `data/metro-lines.geojson` from OpenStreetMap

## Metro data

The spec names the RCRC open data portal. In Nov 2026 the portal (`rcrc.opendatasoft.com`, now `opendata.rcrc.gov.sa`) answers "domain could not be found", so the data comes from **OpenStreetMap** (ODbL; the attribution is shown on the map). It has 6 lines, 82 stations and 10 interchanges.
Each station has `name_en`, `name_ar` (empty when OSM has no real Arabic name), `lines[]` (`ref`, `name`, `color`, `seq` = position along the line) and `interchange`.
If RCRC comes back, map its export to the same shape (`lib/metro.ts`).

## Neighbourhood data

`data/riyadh-districts.json` (`npm run build:districts`, from the Mazad Radar files) comes from the Saudi Post address map via github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts, licensed **GPL-2.0**; credit is shown on the map. Fine for this prototype. If the app is ever sold or closed-source, switch to OpenStreetMap neighbourhoods (ODbL).

## Code map

- `app/page.tsx`: reads the metro GeoJSON on the server and renders `components/MeetupApp.tsx` (state + layout)
- `components/MeetupMap.tsx`: Google map, person pins (draggable), metro toggle; `MetroLayer.tsx` draws lines + stations
- `components/FreeMap.tsx`: the same map on free OpenStreetMap tiles, used when no Google browser key is set (OSM's tile policy covers light use; a busy public site needs its own tile provider)
- `components/PeoplePanel.tsx`, `PersonCard.tsx`, `PlaceSearch.tsx`: people input (name, car/metro, search or pick on map)
- `app/api/places/*`: server-side Places autocomplete + details (10-min in-memory cache, `lib/cache.ts`)
- `app/api/recommend/route.ts` → `lib/recommend.server.ts` (pipeline) → `lib/scoring.ts` (pure scoring), `lib/estimator.ts` (metro/car estimates), `lib/osrm.server.ts`, `lib/google.server.ts`
- `components/TripOptions.tsx`, `ResultsList.tsx`: place type, departure time, ranked results with "why"
- `components/NeighbourhoodPicker.tsx` + `lib/districts.ts` (search, point-in-district); `components/TripDetails.tsx` + `lib/directions.ts` (car steps, Google Maps links); `components/PrefsPanel.tsx` + `lib/preferences.ts`, `lib/cuisine.ts`, `lib/usePrefs.ts` (browser storage); `app/api/route` (car route)
- `lib/people.ts` (pure state + rules), `lib/metro.ts`, `lib/geo.ts`, `lib/i18n.ts` (English strings, RTL-ready)
