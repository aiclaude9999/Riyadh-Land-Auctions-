import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { RefreshMode } from '@/connectors/types';

export const QUEUE_NAME = 'scrape';
const g = globalThis as unknown as { redis?: IORedis; queue?: Queue };

export function redis(): IORedis {
  if (!g.redis) g.redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: false });
  return g.redis;
}

export function scrapeQueue(): Queue {
  if (!g.queue) g.queue = new Queue(QUEUE_NAME, { connection: redis() });
  return g.queue;
}

export interface ScrapeJob { sourceId: string; mode: RefreshMode }

/**
 * Enqueue a scrape. The jobId makes BullMQ ignore duplicates while an identical job is still
 * waiting/active, so the same source+mode is never queued twice.
 */
export async function enqueueScrape(sourceId: string, mode: RefreshMode, priority = mode === 'manual' ? 1 : mode === 'closing' ? 2 : 5) {
  return scrapeQueue().add('scrape', { sourceId, mode } satisfies ScrapeJob, {
    jobId: `${sourceId}__${mode}`,
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 20_000 },
    removeOnComplete: true,
    removeOnFail: true,
  });
}
