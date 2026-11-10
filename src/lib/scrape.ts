/** Runs one connector, records the run, ingests results and fires notifications. */
import { prisma } from './db';
import { logger } from './logger';
import { ingest } from './ingest';
import { processEvents } from './notify';
import { connectors, getConnector } from '@/connectors';
import { BlockedError, type RefreshMode } from '@/connectors/types';
import type IORedis from 'ioredis';

export async function ensureSources() {
  for (const c of connectors) {
    await prisma.source.upsert({
      where: { id: c.id },
      create: { id: c.id, name: c.name, baseUrl: c.baseUrl, method: c.method },
      update: { name: c.name, baseUrl: c.baseUrl, method: c.method },
    });
  }
}

/** Map a scheduler mode to what the connector can actually serve. */
export function effectiveMode(connectorModes: RefreshMode[], mode: RefreshMode): RefreshMode {
  return connectorModes.includes(mode) ? mode : 'discovery';
}

export interface RunOptions { redis?: IORedis; attempt?: number }

export class SkippedError extends Error {}

export async function runScrape(sourceId: string, mode: RefreshMode, opts: RunOptions = {}) {
  const c = getConnector(sourceId);
  if (!c) throw new Error(`Unknown connector ${sourceId}`);
  const log = logger.child({ source: sourceId, mode });
  const lockKey = `lock:scrape:${sourceId}`;
  // Per-source lock: never two concurrent scrapes of the same source (across modes / workers).
  if (opts.redis) {
    const ok = await opts.redis.set(lockKey, `${mode}:${Date.now()}`, 'PX', 10 * 60_000, 'NX');
    if (!ok) {
      log.info('skipped — another scrape of this source is running');
      throw new SkippedError('locked');
    }
  }
  const src = await prisma.source.findUnique({ where: { id: sourceId } });
  const firstSync = !src?.lastSuccessAt;
  const started = Date.now();
  const run = await prisma.scrapeRun.create({ data: { sourceId, mode, status: 'running', attempt: opts.attempt ?? 1 } });
  await prisma.source.update({ where: { id: sourceId }, data: { status: 'running', lastRunAt: new Date() } });
  try {
    const m = effectiveMode(c.modes, mode);
    const raws = await c.fetchAuctions({ mode: m, log });
    const r = await ingest(sourceId, raws);
    const notified = await processEvents(r.events, { suppressNew: firstSync });
    const durationMs = Date.now() - started;
    await prisma.scrapeRun.update({ where: { id: run.id }, data: { status: 'ok', finishedAt: new Date(), durationMs, itemsFound: r.found, created: r.created, updated: r.updated } });
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'ok', lastSuccessAt: new Date(), lastDurationMs: durationMs, lastItemCount: r.found, lastError: null, consecutiveFailures: 0 },
    });
    log.info({ found: r.found, created: r.created, updated: r.updated, notified, ms: durationMs, effective: m }, 'scrape ok');
    return r;
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const blocked = e instanceof BlockedError;
    const msg = String(e?.message ?? e).slice(0, 1000);
    await prisma.scrapeRun.update({ where: { id: run.id }, data: { status: 'error', finishedAt: new Date(), durationMs, error: msg } });
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: blocked ? 'blocked' : 'error', lastDurationMs: durationMs, lastError: msg, consecutiveFailures: { increment: 1 } },
    });
    log.error({ err: msg, blocked, ms: durationMs }, 'scrape failed — previous data kept');
    throw e;
  } finally {
    if (opts.redis) await opts.redis.del(lockKey).catch(() => {});
  }
}
