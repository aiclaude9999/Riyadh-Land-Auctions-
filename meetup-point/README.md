# Riyadh Meetup Point (prototype)

Picks the fairest café or restaurant for 2–6 people in Riyadh, by car or metro.
Spec and build order: [`CLAUDE.md`](./CLAUDE.md). This folder is a separate app; it has nothing to do with Mazad Radar's deploy.

**Built so far:** steps 1–5: map + metro layer, people panel, `/api/recommend` (candidates → travel times → scoring), results list + numbered map markers + ETA breakdown, and the metro fallback estimator with tests. Step 6 (polish) is not started.

**Design (Nov 2026):** phone layout = full-screen map + pull-up panel with three heights (`components/BottomSheet.tsx`); three steps *Who → When → Results* with one big button at the bottom; results = one winner card (fairness bars `FairnessBars.tsx`, Citymapper-style trip strips `TripStrip.tsx`, steps on demand) + sideways alternatives; Riyadh palette (palm green / sand / sky, `tailwind.config.ts`), IBM Plex Sans Arabic (self-hosted via @fontsource), Lucide icons, text ≥ 13 px, logo `components/Logo.tsx`; installable app (`app/manifest.ts`, `public/sw.js`, icons in `public/icons`, *Install app* button / iPhone hint).

**Optimiser + matching + extras (Nov 2026, phases 1–3):**
- *Accuracy:* two-stage search (12×12 fairness grid → ~100 candidates from the fairest area, next to the stations best for the group, and the whole circle); OSRM tables batched; metro users choose *walk* or *car/taxi* to the station; metro waits by time of day (`metroWaitMin`); walk-only trips ≤ 20 min; direction-aware traffic (`directionFactor`); the best places are re-scored with real street walking times; learned corrections from "how long did it really take?" reports (`/api/feedback`, `lib/calibration.server.ts`).
- *Matching:* each person's liked/avoided food; "fits N of M" and a place score (`lib/matching.ts`); three rankings **Fairest / Quickest / Best match** (`styles` in the response, `lib/styleOrder.ts`); places clearly closed at arrival are skipped (`lib/openingHours.ts`, only ~1 % of places list hours).
- *Extras:* "leave at" times so everyone arrives together; best time to meet (`meta.timeOptions`, `betterTime`); heat-aware walking (Open-Meteo forecast or typical Riyadh temperatures, `lib/weather.ts`); fairness over time (past meetups in the browser, `lib/history.ts` → `weights`); each person's reach on the map (`zone.cells[].per`); 🚇 "no line change" places; Ramadan mode (approximate Ramadan traffic, metro hours, iftar warnings).
- Not available for free and therefore not used: price level, parking, family sections, live traffic per road (Google key needed).

**All cafés & restaurants (Nov 2026):** `data/venues-riyadh.json` now combines **Overture Maps Places** (release 2026-11-18, CDLA-Permissive-2.0, confidence ≥ 0.6, food & drink only) with OpenStreetMap: **9,313 places** (was 668), food type known for ~86%. Rebuild: `venv/bin/python scripts/overture/extract_riyadh.py <release> scripts/overture/overture-riyadh.json` (reads only Riyadh row groups over HTTPS), then `npm run build:venues -- --from <osm.json> --overture scripts/overture/overture-riyadh.json` (duplicates merged by name + distance, `lib/venueMerge.ts`; OSM ids kept). Map layer *🍽 All cafés & restaurants* (`/api/venues`, clustered with leaflet.markercluster / @googlemaps/markerclusterer); a place's pop-up has *Reviews on Google Maps* and *Use as meeting place* (scores exactly that place → shown first as ★ *Your pick*). Foursquare Open Source Places was checked but its current release needs a Hugging Face account (the open copy is from Feb 2025), so it is not included.

**Route view per person (Nov 2026):** *Show route on map* focuses the map on one person, like Google Maps: car = road route (OSRM) with a white casing; metro = walk along the streets (FOSSGIS foot router, `routing.openstreetmap.de`) → ride along the real track in the line colour (`lib/metroTrack.ts`) → change → … → walk, with station dots; a route card with Google Maps directions and *Show everyone*. Every step (car turn or metro step) is tappable and zooms the map there. Pieces: `lib/routePieces.ts`.

**Sharing + voting (Nov 2026):** *Share with friends* creates a group (`?g=<id>` link, WhatsApp button). Friends add and edit only their own entry; the organiser edits anyone and runs the search; everyone gets the results and votes on the top 3. Storage `lib/store.server.ts`: Upstash Redis (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) or in memory when unset; one JSON doc per group with a version key and an atomic compare-and-set (Lua), 7-day expiry; tokens stored hashed. Logic `lib/groups.server.ts`, API `app/api/groups/**`, browser `lib/useGroup.ts` (8 s polling while visible, debounced edits). **Going online: see [DEPLOY.md](./DEPLOY.md).**

**Arabic (Nov 2026):** full Arabic UI with right-to-left layout; the English/العربية button is remembered in a cookie so the server renders the right language. Strings in `lib/i18n.ts` (`en`, `ar`; `arMin` handles Arabic counted minutes), hook `useT()` / `useName()` in `components/LocaleProvider.tsx`. Station, line, neighbourhood and venue names switch to Arabic where the data has them; car steps are built from structured OSRM steps in either language.

**Step 6 + "smarter results" (Nov 2026):** day + time-of-day slider; in free mode car times get a *typical traffic* factor per hour (TomTom Traffic Index 2025 averages for Riyadh, `lib/timing.ts`); warnings when the group arrives around a prayer time (`adhan`, Umm al-Qura) or a metro trip falls outside the usual hours (Sat–Thu 5:30–24:00, Fri 10:00–24:00, as announced by Riyadh Public Transport; Ramadan differs; adjust `METRO_HOURS`); "everyone within X min" zone (9×9 grid, approximate); filters: near a metro station, food group.

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
