/**
 * Free-hosting collector, run by .github/workflows/collect.yml every 30 minutes.
 * Collects every API-based source straight into the database (no Redis), then updates statuses,
 * sends "ending soon" notifications and cleans up old data.
 */
import { connectors } from '@/connectors';
import { ensureSources, runScrape } from '@/lib/scrape';
import { ensureDefaultRules, checkEndingSoon } from '@/lib/notify';
import { sweepEnded } from '@/lib/ingest';
import { prisma } from '@/lib/db';

async function main() {
  await ensureSources();
  await ensureDefaultRules();
  await prisma.source.updateMany({ where: { status: 'running' }, data: { status: 'idle' } });
  const enabled = new Set((await prisma.source.findMany({ where: { enabled: true }, select: { id: true } })).map((s) => s.id));
  const api = connectors.filter((c) => c.method !== 'browser' && enabled.has(c.id));
  const now = new Date();
  // once a day (first run after midnight UTC) also refresh recently ended auctions for final status/prices
  const daily = process.env.COLLECT_ENDED === '1' || (now.getUTCHours() === 0 && now.getUTCMinutes() < 30);
  let ok = 0;
  for (const c of api) {
    for (const mode of daily && c.modes.includes('ended') ? (['discovery', 'ended'] as const) : (['discovery'] as const)) {
      try {
        const r = await runScrape(c.id, mode);
        if (mode === 'discovery') ok++;
        console.log(`✔ ${c.id} ${mode}: found=${r.found} new=${r.created} updated=${r.updated}`);
      } catch (e: any) {
        console.log(`✘ ${c.id} ${mode}: ${e.message}`);
      }
    }
  }
  const sweep = await sweepEnded();
  const ending = await checkEndingSoon();
  // housekeeping: keep the free database small
  await prisma.scrapeRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 14 * 86_400_000) } } });
  const old = await prisma.auction.deleteMany({ where: { status: 'ended', endAt: { lt: new Date(Date.now() - 120 * 86_400_000) }, saved: { is: null } } });
  console.log(`sweep=${JSON.stringify(sweep)} endingSoonAlerts=${ending} deletedOld=${old.count} sourcesOk=${ok}/${api.length}`);
  await prisma.$disconnect();
  if (ok === 0) process.exit(1); // every source failed → show a red run in GitHub
}
main();
