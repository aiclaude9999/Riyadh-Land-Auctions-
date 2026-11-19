# Riyadh Meetup Point — Prototype

## Goal
Web app that recommends the best cafe/restaurant for 2–6 people to meet in Riyadh,
based on each person's location and travel mode (car or metro), live traffic and
metro access. Prototype quality: working end-to-end, clean UI, no auth.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Map: Google Maps JavaScript API (@vis.gl/react-google-maps)
- APIs (server-side only, key in .env.local as GOOGLE_MAPS_API_KEY):
  - Routes API `computeRouteMatrix` — DRIVE with TRAFFIC_AWARE, TRANSIT
  - Places API (New) `searchNearby` — types: cafe, restaurant
- Metro data: /data/metro-stations.geojson (from RCRC open data portal,
  rcrc.opendatasoft.com — "metro stations in Riyadh by metro line and station type")
- No database for v1; cache API responses in memory for 10 min

## User flow
1. Add 2–6 people: name, location (map pin or address search), mode (car | metro)
2. Choose departure time (now / later) and venue type (cafe | restaurant | both)
3. Click "Find meeting point"
4. Show ranked top 5 venues on map + list with each person's ETA

## Algorithm (lib/scoring.ts — keep it pure and unit-tested)
1. Candidate area: weighted centroid of all people; search radius = max(3 km,
   0.5 × max pairwise distance). Also add candidates within 600 m of the 3 metro
   stations nearest the centroid.
2. Fetch up to 40 candidate venues (Places), drop closed / rating < 3.8.
3. Travel times: one route matrix call per mode group (car people → DRIVE,
   metro people → TRANSIT).
4. Score per venue:
   - primary: max ETA across people (minimax fairness)
   - tiebreak: sum of ETAs
   - bonus: −3 min if venue ≤ 400 m walk from a metro station
   - penalty: +1.5× walking minutes for metro users (heat factor, configurable)
5. Return top 5 with breakdown so the UI can explain "why this venue".

## Fallback
If TRANSIT returns no route, estimate metro time locally:
walk to nearest station (5 km/h) + 4 min wait + 1.5 min/station + 5 min per
transfer + walk from station. Flag these ETAs as "estimated" in the UI.

## Rules
- Never expose the API key to the client except a separate restricted browser key
- Mark estimated vs API-sourced ETAs clearly
- Bilingual-ready UI (English first, Arabic RTL later)
- Write tests for scoring.ts and the fallback estimator

## Build order
1. Scaffold + map with metro stations layer
2. People input panel
3. /api/recommend route: candidates → matrix → scoring
4. Results list + map markers + ETA breakdown
5. Fallback estimator + tests
6. Polish (time-of-day slider, venue filters)
