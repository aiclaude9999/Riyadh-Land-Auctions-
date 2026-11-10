# Mazad Radar (رادار المزادات) — notes for Claude

**Read `docs/PROJECT_HISTORY.md` first** — full history, decisions, live setup and open to-dos.

## Essentials
- Owner: non-developer in Riyadh, writes English/Arabic, sends phone photos of screens, has **no money** (keep everything free), wants click-by-click steps.
- Goal: aggregate Saudi auctions, focus on **land / real estate in Riyadh**.
- Live app: https://mazad-radar.netlify.app (Netlify + Neon Postgres, password via `APP_PASSWORD`). Data collected every 30 min by GitHub Actions `collect.yml` → `scripts/collect.ts`.
- Work on branch `ccr-684fffdf-bi3tdz` (repo default). Each push redeploys Netlify (costs 15 of 300 free monthly credits) — batch changes.
- Sources working: Mobasher, Saudi Auctions (auctions.com.sa), Soum, Tarsyah, Mazadat, Qemah. Not connected: Infath, Wasalt, Athmann.
- **Never bypass bot protection, Cloudflare challenges or geo-blocks** (decided; owner's requests to force Wasalt/Infath were declined).
- Never commit secrets; never repeat the database URL or passwords in chat or files.

## Commands
- `npm test` (vitest), `npm run typecheck`, `npm run scrape -- <source>` (needs DATABASE_URL; in the cloud sandbox prefix `NODE_USE_ENV_PROXY=1`).
- New source = `src/connectors/<name>.ts` + one line in `src/connectors/index.ts` + test with trimmed real fixture.
