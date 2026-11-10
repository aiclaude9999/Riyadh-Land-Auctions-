/**
 * Free hosting mode: collect auctions from the API-based sources and write ONE static page
 * (site/index.html) with the data embedded. No database or Redis needed.
 * Run by .github/workflows/pages.yml every hour and published with GitHub Pages.
 *
 *   npx prisma generate && npx tsx scripts/build-static.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connectors } from '@/connectors';
import type { RawAuction } from '@/connectors/types';
import { toListingData, propertySummary } from '@/lib/ingest';
import { classifyGeo } from '@/lib/geo';
import { findBestMatch } from '@/lib/dedup';
import { logger } from '@/lib/logger';

const id = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 8);

async function main() {
  const now = new Date();
  const sources: { id: string; n: string; s: string; ok: string | null; e: string | null }[] = [];
  const raws: { src: string; r: RawAuction }[] = [];
  for (const c of connectors) {
    if (c.method === 'browser' || c.saudiOnly) {
      sources.push({ id: c.id, n: c.name, s: 'blocked', ok: null, e: 'Not collected in free hosting mode (the site blocks automated access from outside Saudi Arabia).' });
      continue;
    }
    try {
      const list = await c.fetchAuctions({ mode: 'discovery', log: logger.child({ source: c.id }) });
      list.forEach((r) => raws.push({ src: c.id, r }));
      sources.push({ id: c.id, n: c.name, s: 'ok', ok: now.toISOString(), e: null });
      console.log(`✔ ${c.id}: ${list.length}`);
    } catch (e: any) {
      sources.push({ id: c.id, n: c.name, s: 'error', ok: null, e: String(e?.message ?? e).slice(0, 300) });
      console.log(`✘ ${c.id}: ${e?.message}`);
    }
  }

  const auctions: any[] = [];
  const assets: any[] = [];
  for (const { src, r } of raws) {
    const d = toListingData(r, now);
    if (d.status === 'ended') continue;
    const info = (r.assets ?? []).map((a) => ({ propertyType: a.propertyType ?? null, usage: a.usage ?? null, areaSqm: a.areaSqm ?? null, startPrice: a.startPrice ?? null, deposit: a.deposit ?? null }));
    const ps = propertySummary(d.category, d.title, info);
    const assetGeo = (r.assets ?? []).map((a) => classifyGeo({ cities: [a.city], regions: [a.region], districts: [a.district], lat: a.latitude, lng: a.longitude }));
    const rc = d.geo.hasRiyadhCity || assetGeo.some((g) => g.hasRiyadhCity);
    const rr = rc || d.geo.hasRiyadhRegion || assetGeo.some((g) => g.hasRiyadhRegion);
    const rec = {
      i: id(`${src}:${r.externalId}`), t: d.title, c: d.category, s: d.status, st: d.startAt, en: d.endAt,
      ci: d.cities, d: d.district, rc, rr, ml: d.geo.isMultiLocation,
      L: ps.hasLand, lc: ps.landCount, la: ps.landAreaSqm, pt: ps.propertyTypes, u: ps.usages,
      n: d.assetCount, sp: d.startPrice ?? ps.minAssetPrice, cp: d.currentPrice, dp: d.deposit ?? ps.minAssetDeposit, o: d.organizer,
      im: d.images[0] ?? null,
      src: [[src, r.url]] as [string, string][],
      // for in-memory de-duplication across platforms
      _dedup: { sourceIds: [src], normalizedTitle: d.normalizedTitle, normalizedOrganizer: d.normalizedOrganizer, category: d.category, startAt: d.startAt, endAt: d.endAt, cities: d.cities, assetCount: d.assetCount, crossRefs: d.crossRefs },
    };
    const dup = findBestMatch(rec._dedup, auctions.map((a) => Object.assign(a._dedup, { ref: a })));
    if (dup) {
      const a = (dup as any).ref;
      a.src.push(...rec.src);
      a._dedup.sourceIds.push(src);
      continue;
    }
    auctions.push(rec);
    (r.assets ?? []).forEach((a, k) => assets.push({
      t: a.title, pt: a.propertyType ?? null, u: a.usage ?? null, ar: a.areaSqm ?? null, sp: a.startPrice ?? null, cp: a.currentPrice ?? null, dp: a.deposit ?? null,
      d: a.district ?? null, ci: a.city ?? a.region ?? null, g: assetGeo[k].scope, lat: a.latitude ?? null, lng: a.longitude ?? null,
      im: a.images?.[0] ?? null,
      ai: rec.i, at: rec.t, as: rec.s, aen: rec.en, ast: rec.st, src, url: a.url ?? r.url,
    }));
  }
  auctions.forEach((a) => delete a._dedup);
  // real-estate assets only (vehicle lots are already shown as auctions)
  const reAssets = assets.filter((x) => auctions.find((a) => a.i === x.ai)?.c === 'real_estate');

  const data = JSON.stringify({ at: now.toISOString(), auctions, assets: reAssets, sources }).replace(/<\//g, '<\\/');
  const html = readFileSync('static/template.html', 'utf8').replace('__DATA__', () => data);
  mkdirSync('site', { recursive: true });
  writeFileSync('site/index.html', html);
  writeFileSync('site/data.json', JSON.stringify({ at: now.toISOString(), auctions, assets: reAssets, sources }));
  console.log(`site/index.html: ${auctions.length} auctions, ${reAssets.length} real-estate assets, ${auctions.filter((a) => a.L && a.rc).length} Riyadh land auctions`);
  if (!sources.some((s) => s.s === 'ok')) process.exit(1); // nothing collected → fail so the old page stays online
}
main();
