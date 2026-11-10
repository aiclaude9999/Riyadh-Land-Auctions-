/**
 * Sources that could not be inspected from the development environment because they block
 * automated clients (Cloudflare challenge / connection reset). Each is a separate connector that
 * loads the site with Playwright, captures its own JSON API responses and maps them with the
 * generic mapper. If a challenge is shown the run fails with BlockedError and is reported in the
 * Sources panel — existing data is kept.
 */
import { loadAndCapture } from './browser';
import { findAuctionArrays, mapHeuristic } from './heuristic';
import { getText } from '@/lib/http';
import type { Connector, RawAuction } from './types';

function browserConnector(cfg: { id: string; name: string; baseUrl: string; pages: string[]; match?: RegExp; urlFor: (id: string, o: any) => string }): Connector {
  return {
    id: cfg.id, name: cfg.name, baseUrl: cfg.baseUrl, method: 'browser', modes: ['discovery', 'manual'],
    async fetchAuctions({ log }) {
      const byId = new Map<string, RawAuction>();
      for (const p of cfg.pages) {
        const { json } = await loadAndCapture(cfg.baseUrl + p, { match: cfg.match });
        for (const c of json) for (const arr of findAuctionArrays(c.data)) for (const o of arr) {
          const r = mapHeuristic(o, cfg.urlFor);
          if (!byId.has(r.externalId)) byId.set(r.externalId, r);
        }
        log.debug({ page: p, responses: json.length, found: byId.size }, `${cfg.id} captured`);
      }
      if (byId.size === 0) throw new Error('Page loaded but no auction data could be recognised in its API responses (connector mapping needs updating)');
      return [...byId.values()];
    },
  };
}

export const wasalt = browserConnector({
  id: 'wasalt', name: 'وصلت للمزادات', baseUrl: 'https://auction.wasalt.sa', pages: ['/', '/auctions'],
  urlFor: (id) => `https://auction.wasalt.sa/auction/${id}`,
});

export const athmann = browserConnector({
  id: 'athmann', name: 'أثمان', baseUrl: 'https://athmann.com.sa', pages: ['/', '/auctions'],
  urlFor: (id) => `https://athmann.com.sa/auctions/${id}`,
});

const infathBrowser = browserConnector({
  id: 'infath', name: 'إنفاذ', baseUrl: 'https://infath.gov.sa', pages: ['/ar/auctions', '/'],
  urlFor: (id) => `https://infath.gov.sa/ar/auctions/${id}`,
});

export const infath: Connector = {
  ...infathBrowser,
  async fetchAuctions(ctx) {
    // Fast reachability probe first so a geo-block fails quickly with a clear message.
    try {
      await getText('https://infath.gov.sa/', { timeoutMs: 15_000, retries: 0 });
    } catch (e: any) {
      if (/ECONNRESET|socket|fetch failed|other side closed|terminated/i.test(`${e?.cause?.code ?? ''} ${e?.cause?.message ?? ''} ${e?.message ?? ''}`)) {
        const { BlockedError } = await import('./types');
        throw new BlockedError(`infath.gov.sa reset the connection (the site appears to accept only Saudi networks): ${e?.cause?.code ?? e.message}`);
      }
    }
    return infathBrowser.fetchAuctions(ctx);
  },
};
