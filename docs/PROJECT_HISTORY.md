# Mazad Radar — project history, decisions and state

> Written so any future session (or a compacted conversation) can continue without the chat.
> Last updated: 2026-11-10 (Riyadh). **No secrets in this file** — passwords/links live only in GitHub Secrets, Netlify env vars and Neon.

---

## 1. The owner and how to work with them

- Owner: GitHub `aiclaude9999`. Lives in **Riyadh, KSA**. Writes in English and Arabic, reads Arabic UI.
- **Not a developer.** Needs click-by-click steps, sends **phone photos of the screen**. Avoid jargon; one step at a time; say where buttons are.
- **No money** — everything must stay **free** (asked explicitly). Avoid paid plans/services.
- Asked to be careful with credits/usage.
- Has a **Windows laptop** (Lenovo) in KSA, Chrome + Edge, Claude desktop app. PowerShell 5.1. Pasting into hidden prompts fails there; right-click = paste.
- Main interest: **land and real-estate auctions in Riyadh** (city first, then Riyadh region).
- Wants the app named **Mazad Radar / رادار المزادات**, password-protected.

## 2. Where everything lives

| Thing | Location |
|---|---|
| Code | GitHub `aiclaude9999/Riyadh-Land-Auctions-` (now **public**), branch **`ccr-684fffdf-bi3tdz`** (also the repo's default branch). No PR / `main` merge done. |
| Live full app | **https://mazad-radar.netlify.app** (Netlify project `mazad-radar`, site id `4a0d17cb-fb8b-4134-b62b-206d92d48dec`, functions region us-east-2). Password = Netlify env `APP_PASSWORD`. |
| Database | **Neon** Postgres, project `mazad-radar`, region **AWS eu-central-1 (Frankfurt)**, "Just Postgres". Connection string = pooled (`-pooler` host). Stored as GitHub secret `DATABASE_URL` and Netlify env `DATABASE_URL`. |
| Collector | GitHub Actions **`collect.yml`** ("Collect auctions") every 30 min (`7,37 * * * *` UTC) + manual "Run workflow". Runs `scripts/collect.ts` (migrations first, using the non-pooled host). |
| Old free static page | GitHub Pages **https://aiclaude9999.github.io/Riyadh-Land-Auctions-/** built hourly by **`pages.yml`** — single page, **no password**, no saved/notifications. Still running (owner never answered whether to turn it off). |
| Snapshot artifact | claude.ai artifact https://claude.ai/artifact/KgDLTSgu6zopGN4NnbZ8Ed (static snapshot from 10 Nov; private). |
| Unused hosting configs | `render.yaml` + `Dockerfile.render` (Render, paid ~$13/mo — owner declined), `docker-compose.yml` (local/VPS). |

### Cloud environment (Claude Code on the web)
Environment "Personal Website" network allowlist was extended for the auction hosts:
mobasher.sa, www.mobasher.sa, discovery-api.prod.mobasher.sa, reference-data-api.prod.mobasher.sa, auctions.com.sa, www.auctions.com.sa,
api.mazadat.sa, mazadat.sa, www.mazadat.sa, tarsyah.com/.sa (+www), admin.tarsyah.sa, qemah.sa, www.qemah.sa, cdn.qemah.sa,
soum.tech, www.soum.tech, api.soum.tech, infath.gov.sa (+www), auction.wasalt.sa, wasalt.sa (+www), api.wasalt.sa, athmann.com.sa (+www).
In this sandbox Node `fetch` needs `NODE_USE_ENV_PROXY=1`. netlify.app / github.io are NOT reachable from the sandbox (use Netlify MCP tools / GitHub API instead). The GitHub API via curl works with the session's token (used to dispatch workflows and read run logs).

## 3. Data sources (status as of 2026-11-10)

| Source | Status | How | Notes |
|---|---|---|---|
| Mobasher `mobasher.sa` | ✅ | `discovery-api.prod.mobasher.sa/api/v1/discovery/auctions` (cursor) + `/auction-products?auctionContainerIds=...` (batched) | Full plot data (propertyType Land, usage, spaceSqm, openingPrice, insuranceAmount=deposit, geo). Times UTC. URL `/auctions/t-container-details/{id}` or `/hybrid-auction/{id}`. |
| Saudi Auctions `auctions.com.sa` | ✅ | Odoo JSON `/en_US/api/get_auction_filter`, `/api/auction/products/{id}`, `/api/auction/products/map/{id}` | Naive UTC times. `advance` = deposit. |
| Soum `soum.tech` | ✅ (added 10 Nov) | SvelteKit `__data.json` (devalue) `/auctions/__data.json?category=1&page=N`, `/auctions/{id}/assets/__data.json` | Naive UTC. `bidWithMeterPrice` → total = price × area. Runs some Infath auctions (`isInfath`). Contact fields not stored. |
| Tarsyah `tarsyah.sa` | ✅ | `admin.tarsyah.sa/api/v1/auctions?limit=30&page=N`, `/api/v1/auction/{id}` (items) | No city field; location from text only. |
| Mazadat `mazadat.sa` | ✅ | `POST api.mazadat.sa/api/v2/search` body `{"$and":[{"status":{"$in":[...]}}]}` | Each hit is one lot (vehicles). Epoch ms. No organiser name. |
| Qemah `qemah.sa` | ✅ | `/auctions/{live\|upcoming\|finished}?page=N` (XHR JSON) | Car plates/cars. Only start date/time (Riyadh local). Lot records contain personal documents → only auction-level fields read. |
| Infath `infath.gov.sa` | ✅ via owner's KSA laptop | `src/connectors/infath.ts` (`saudiOnly`), HTML list + detail pages, plain honest requests | Resets connections from outside KSA, so it runs on the owner's Windows laptop (`scripts/infath-laptop`, task `MazadRadar-Infath` every 2 h). First test run got HTTP 500, but the scheduled run 5 min later **succeeded with the same plain request** → the 500 was a temporary server error, not a block. Disguising as a browser was proposed earlier and **blocked by the safety classifier** — never do that. Re-enabled on 10 Nov after the owner saw Infath cards on the site. Updates only while the laptop is on. |
| Wasalt `auction.wasalt.sa` | ❌ | — | Cloudflare "Just a moment…" on every host. Owner asked to force past it twice ("not against their terms") → **declined** (deliberate bot barrier). Offered: bookmarklet "Import from Wasalt" (human-in-the-loop) and/or email asking for API key — owner said **no** to both. Search engines index Wasalt pages (public snippets). |
| Athmann `athmann.com.sa` | ❌ | — | Cloudflare "Attention Required". Not bypassed. |

**Policy decided in this project: never bypass bot protection / geo-blocks / challenges** (Cloudflare, Infath's refusal). Only public, unprotected endpoints the site itself serves, or official access granted by the site.

## 4. Architecture (code map)

- Next.js 15 App Router + TypeScript + Tailwind (RTL Arabic UI), Prisma 6 + PostgreSQL, BullMQ + Redis (worker mode only), Cheerio, Playwright (only for the unused browser connectors), pino logs, vitest.
- `src/connectors/*` — one file per source, registry `src/connectors/index.ts` (add a source = new file + one line). `types.ts`: `Connector`, `RawAuction`, `RawAsset`, `BlockedError`, `saudiOnly` flag; `connectorsForThisNetwork()` (SAUDI_NETWORK=1 runs only Saudi-only sources).
- `src/lib/normalize.ts` Arabic normalisation, categories, status, money, **property type / usage** (`mapPropertyType`, `mapUsage`).
- `src/lib/geo.ts` Riyadh city / Riyadh region / other (city names, region towns, Riyadh districts, lat/lng box). Classification uses the **asset's** location.
- `src/lib/dedup.ts` cross-platform dedup (cross-refs, title similarity, organiser, ±3h dates, city, asset count; never merges same source).
- `src/lib/ingest.ts` listings → canonical auctions, land summary (`hasLand`, `landCount`, `landAreaSqm`, `propertyTypes`, `usages`), change log, events; parallel ingest (`INGEST_CONCURRENCY`), skips auctions ended >120 days.
- `src/lib/notify.ts` rules (new_riyadh [landOnly default], new_category, ending_saved, date_changed, price_changed) + channels (in-app, Telegram via `TELEGRAM_BOT_TOKEN`).
- `src/lib/scrape.ts` run one connector, ScrapeRun records, Redis lock when available.
- `src/lib/scheduler-mode.ts` worker (REDIS_URL set) vs github mode; "تحديث الآن" triggers `collect.yml` via `GITHUB_TOKEN`+`GITHUB_REPO` (not configured on Netlify yet → button shows a message).
- `src/lib/auth.ts` + `src/middleware.ts` + `/login` — site password (`APP_PASSWORD`, HMAC cookie, 90 days).
- `src/worker/index.ts` BullMQ worker + scheduler (Docker/paid mode only).
- `scripts/collect.ts` GitHub collector (no Redis). `scripts/build-static.ts` + `static/template.html` → GitHub Pages page. `scripts/scrape-once.ts` local test. `scripts/infath-laptop/*.ps1` Windows Infath collector (currently unused).
- Pages: `/` dashboard (default **land** focus, Riyadh city), `/properties` (every asset), `/map` (Leaflet; base maps: OpenStreetMap streets, Esri satellite, satellite + roads/names, choice remembered; pins = assets with lat/lng, coloured by property type, popup with area/price/deposit/auction; API `/api/map`), `/auctions/[id]` (plots table, change history), `/saved`, `/sources`, `/notifications`, `/settings`, `/login`.
- DB migrations: `prisma/migrations/20261110000000_init`, `20261110010000_land_fields`.
- Tests: 78 passing (`npm test`), fixtures are trimmed real responses (personal/contact fields removed).

## 5. Timeline (10 Nov 2026)

1. Probed 8 sites; built the full app (connectors, scheduler, dedup, Arabic dashboard, notifications, Docker). 5 sources worked.
2. Owner couldn't run code → screenshots in README, Claude artifact snapshot + HTML file.
3. Land focus: per-plot data from Mobasher/Saudi Auctions/Tarsyah; land filters, plots table.
4. "العقارات" properties page (every asset).
5. Hosting: Render (paid) prepared → owner has no money → free GitHub Pages static page (made repo public) → owner wanted full version → **Netlify + Neon + GitHub Actions** with password, renamed **Mazad Radar**.
6. First collector run timed out (US runners ↔ Frankfurt DB latency) → parallel ingest → ~2.5 min runs.
7. Infath: confirmed geo-block; built HTML connector + Windows laptop collector; first run got 500, bypass declined, laptop cleaned up — but a scheduled run had already succeeded (Infath cards appeared), so the 500 was temporary. Laptop collector re-enabled with the same honest connector.
8. Added **Soum**. Wasalt bypass requested and declined.
9. Infath laptop collector re-enabled (works with plain requests). Added `CLAUDE.md` + this file.
10. Added the **map page** (`/map`). Coordinates come mainly from Mobasher, Saudi Auctions, Mazadat; Soum sometimes; Infath/Qemah none.
11. (11 Nov) **Deals layer on the map** ("أسعار الصفقات"): Ministry of Justice quarterly sales (open.data.gov.sa, geo-blocked outside KSA — owner downloads the CSVs on the laptop and uploads them). Riyadh-city only, summarised per district (count, value, median SAR/m², estimated land = residential single property > 200 m²), placed at district centroids from Saudi Post boundaries (homaily/Saudi-Arabia-Regions-Cities-and-Districts). Static file `src/data/riyadh-deals.json`, no DB. Quarters 2025-Q4 → 2026-Q3. **Finding:** Riyadh-city deals in the MoJ files fell every quarter (4,828 → 2,889 → 1,676 → **1** in 2026-Q3), so these files no longer cover Riyadh city (likely registered elsewhere, e.g. the Real Estate Registry). REGA's Nafath-protected deals were not scraped (declined).
12. Owner asked for coloured districts instead of circles: the layer now fills each district boundary (`src/data/riyadh-district-shapes.json`, simplified ≈20 m) by the chosen metric — land (estimate) / all / residential / commercial SAR/m² or deal count; opens on land, all quarters together; districts with < 3 deals are grey dashed. Auction assets became drop-pin icons.
13. **Infath assets fixed**: the detail-page parser had been written blind (no real page) and found 0 assets. Rewritten from a real page the owner saved (AuctionId=595, fixture `tests/fixtures/infath-detail.html`): per-asset type, area, entry deposit (مبلغ الدخول), district (from description or the page's district filter) and coordinates by reading the redirect of the asset's Google Maps short link (best effort; untested from the cloud because Google short links are blocked there). Infath shows no per-asset opening price. The laptop must re-run the setup one-liner to get new code.

## 6. Open items / to-do

### ⏳ Next Netlify deploy — batch (owner wants ONE deploy for all of these, to save credits)
Code may be written and pushed with `[skip ci]` meanwhile; do the real deploy only when the owner says so.
- [ ] Infath assets: show the **description (وصف العقار)** and **notes (الملاحظات)** on the Properties page (and map popup). Needs new Asset fields (e.g. `description`, `notes`) + migration, connector to fill them (`parseInfathDetail` already reads both sections), UI.
- [x] (code pushed, not deployed) **Riyadh Metro on the map**: 6 lines + stations from OpenStreetMap (`src/data/riyadh-metro.json`, built by `scripts/metro/build-metro.ts` via the OSM API; ODbL attribution shown). Toggle "🚇 مترو الرياض" (on by default, remembered), drawn above coloured districts, below auction pins.
- [ ] Optional map auto-refresh (from earlier list).

- 🔐 **Change `APP_PASSWORD`** on Netlify — it is still the weak example password from testing. Then redeploy.
- 🔐 **Rotate the Neon DB password** — the connection string was exposed (owner's screenshot + PowerShell history; also seen via Netlify tool). After reset, update GitHub secret, Netlify env (+ redeploy). Owner was told to delete PowerShell history: `Remove-Item (Get-PSReadLineOption).HistorySavePath`.
- ❓ GitHub Pages static page has **no password** — ask owner whether to disable `pages.yml`/Pages.
- Optional: "تحديث الآن" on Netlify needs `GITHUB_TOKEN` (fine-grained, Actions read/write on this repo) + `GITHUB_REPO=aiclaude9999/Riyadh-Land-Auctions-`.
- Optional: raise UI refresh to 300 s in Settings to save Netlify credits (300 credits/month free; each deploy = 15 credits; an open tab ≈ 0.7 credits/hour).
- Watch Neon free usage (collector every 30 min ≈ 6 h active/day).
- Deals layer: add a new quarter = owner sends the MoJ CSV → `npx tsx scripts/deals/build-deals.ts 2025-Q4=… 2026-Q1=… …` (pass ALL quarters; raw CSVs are not committed — 2025-Q4/2026-Q1 came from github.com/civillizard/Saudi-Real-Estate-Data `moj/sales`). Riyadh city is nearly absent from 2026-Q3, so look for another official, open source for Riyadh deals.
- Ideas not started: Telegram alerts, emailing Infath/Wasalt for official data access (owner declined for Wasalt).

## 7. How to operate

- Run collector now: GitHub → Actions → "Collect auctions" → Run workflow (or API `POST /repos/aiclaude9999/Riyadh-Land-Auctions-/actions/workflows/collect.yml/dispatches` with `{"ref":"ccr-684fffdf-bi3tdz"}`).
- Every push to the branch redeploys Netlify (15 credits) and rebuilds GitHub Pages.
- Local dev: Postgres + Redis, `cp .env.example .env`, `npx prisma migrate deploy`, `npm run scrape`, `npm run dev` / `npm run worker`. Tests `npm test`, types `npm run typecheck`.
- Add a source: `src/connectors/<name>.ts` exporting a `Connector`, add to `connectors` in `index.ts`, add tests with a trimmed real fixture.
