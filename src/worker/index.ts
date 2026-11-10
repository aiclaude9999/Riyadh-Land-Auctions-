/**
 * Background worker: BullMQ consumer + scheduler loop.
 *   discovery 30m · live 10m · closing(<1h) 3m · upcoming 60m · ended 24h   (editable in Settings)
 * Run with:  npm run worker
 */
import { Worker, UnrecoverableError, type Job } from 'bullmq';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getSettings } from '@/lib/settings';
import { enqueueScrape, redis, QUEUE_NAME, type ScrapeJob } from '@/lib/queue';
import { runScrape, ensureSources, SkippedError } from '@/lib/scrape';
import { sweepEnded } from '@/lib/ingest';
import { ensureDefaultRules, checkEndingSoon } from '@/lib/notify';
import { connectors } from '@/connectors';
import { BlockedError, type RefreshMode } from '@/connectors/types';
import { closeBrowser } from '@/connectors/browser';

const log = logger.child({ component: 'scheduler' });
const conn = redis();

const worker = new Worker<ScrapeJob>(
  QUEUE_NAME,
  async (job: Job<ScrapeJob>) => {
    const { sourceId, mode } = job.data;
    try {
      const r = await runScrape(sourceId, mode, { redis: conn, attempt: job.attemptsMade + 1 });
      return { found: r.found, created: r.created };
    } catch (e) {
      if (e instanceof SkippedError) return { skipped: true };
      if (e instanceof BlockedError) throw new UnrecoverableError(e.message); // don't hammer a site that blocks us
      throw e; // retried with exponential backoff (see enqueueScrape)
    }
  },
  { connection: conn, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3) },
);
worker.on('failed', (job, err) => log.warn({ job: job?.id, attempts: job?.attemptsMade, err: err.message }, 'job failed'));

// live/upcoming are covered by the start-up discovery run, so they start one interval later.
const lastRun: Partial<Record<RefreshMode, number>> = { live: Date.now(), upcoming: Date.now() };

async function enabledSources() {
  const rows = await prisma.source.findMany({ where: { enabled: true }, select: { id: true } });
  const ids = new Set(rows.map((r) => r.id));
  // On small hosted servers the browser-based sources (blocked by Cloudflare / geo-block anyway) can be skipped to save memory.
  const noBrowser = process.env.DISABLE_BROWSER_SOURCES === '1';
  const saudi = process.env.SAUDI_NETWORK === '1';
  return connectors.filter((c) => ids.has(c.id) && !(noBrowser && c.method === 'browser') && (!c.saudiOnly || saudi));
}

async function tick() {
  const s = await getSettings();
  const now = Date.now();
  const due = (mode: RefreshMode, minutes: number) => {
    if (lastRun[mode] && now - lastRun[mode]! < minutes * 60_000) return false;
    lastRun[mode] = now;
    return true;
  };
  const srcs = await enabledSources();
  const plan: [RefreshMode, number][] = [
    ['discovery', s.intervals.discoveryMin], ['live', s.intervals.liveMin], ['upcoming', s.intervals.upcomingMin], ['ended', s.intervals.endedMin],
  ];
  for (const [mode, min] of plan) {
    if (!due(mode, min)) continue;
    for (const c of srcs) {
      // Browser connectors are expensive: only on discovery. Others: modes they don't support fall back to discovery.
      if (c.method === 'browser' && mode !== 'discovery') continue;
      if (mode === 'ended' && !c.modes.includes('ended')) continue;
      await enqueueScrape(c.id, c.modes.includes(mode) ? mode : 'discovery');
    }
    log.info({ mode, sources: srcs.length }, 'scheduled');
  }
  // closing soon: only sources that actually have live auctions ending within the window
  if (due('closing', s.intervals.closingMin)) {
    const until = new Date(now + s.closingWindowMin * 60_000);
    const rows = await prisma.listing.findMany({ where: { status: 'live', endAt: { gt: new Date(now), lte: until } }, distinct: ['sourceId'], select: { sourceId: true } });
    for (const r of rows) {
      const c = srcs.find((x) => x.id === r.sourceId);
      if (c && c.modes.includes('closing')) await enqueueScrape(c.id, 'closing');
    }
  }
}

let sweepAt = 0;
async function housekeeping() {
  await checkEndingSoon().catch((e) => log.warn({ err: String(e) }, 'ending-soon check failed'));
  if (Date.now() - sweepAt > 5 * 60_000) {
    sweepAt = Date.now();
    const r = await sweepEnded();
    if (r.ended || r.started) log.info(r, 'status sweep');
    await prisma.scrapeRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 14 * 86_400_000) } } });
  }
}

async function main() {
  await ensureSources();
  await ensureDefaultRules();
  await prisma.source.updateMany({ where: { status: 'running' }, data: { status: 'idle' } }); // crashed runs
  log.info({ connectors: connectors.map((c) => c.id) }, 'worker started');
  const loop = async () => {
    try { await tick(); await housekeeping(); } catch (e) { log.error({ err: String(e) }, 'scheduler tick failed'); }
  };
  await loop();
  setInterval(loop, 30_000);
}

async function shutdown() {
  log.info('shutting down');
  await worker.close();
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((e) => {
  log.fatal({ err: String(e) }, 'worker failed to start');
  process.exit(1);
});
