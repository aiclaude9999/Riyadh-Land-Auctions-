import { BlockedError } from '@/connectors/types';

export const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ??
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 RiyadhAuctionTracker/0.1';

export class HttpError extends Error {
  constructor(public status: number, public url: string, body?: string) {
    super(`HTTP ${status} for ${url}${body ? ` — ${body.slice(0, 160)}` : ''}`);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOpts extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

/** fetch with timeout + exponential backoff for transient errors (network, 429, 5xx). */
export async function httpFetch(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = 25_000, retries = 2, headers, ...init } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8', ...(headers as Record<string, string>) },
      });
      if (res.ok) return res;
      const body = await res.text().catch(() => '');
      if (res.status === 403 && /cloudflare|just a moment|attention required|cf-chl/i.test(body)) {
        throw new BlockedError(`Bot protection (Cloudflare) blocked ${url}`);
      }
      const err = new HttpError(res.status, url, body);
      if (res.status !== 429 && res.status < 500) throw err;
      lastErr = err;
    } catch (e) {
      if (e instanceof BlockedError || (e instanceof HttpError && e.status < 500 && e.status !== 429)) throw e;
      lastErr = e;
    } finally {
      clearTimeout(t);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt + Math.random() * 300);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function getJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await httpFetch(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers as any) } });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 120)}`);
  }
}

export async function getText(url: string, opts: FetchOpts = {}): Promise<string> {
  return (await httpFetch(url, opts)).text();
}
