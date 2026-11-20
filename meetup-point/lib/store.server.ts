/**
 * Tiny key-value store for shared groups.
 * - Online: Upstash Redis over its REST API (Vercel's Upstash integration sets KV_REST_API_URL / KV_REST_API_TOKEN;
 *   UPSTASH_REDIS_REST_URL / _TOKEN also work).
 * - Without those variables (your laptop): kept in memory, so sharing only works inside that one running app.
 * Every key expires (groups are deleted after 7 days).
 */
export interface Store {
  get(key: string): Promise<string | null>;
  /** Writes `value` to `docKey` only if `verKey` still holds `expectVersion`; then bumps the version. */
  compareAndSet(docKey: string, verKey: string, expectVersion: number, value: string, ttlSec: number): Promise<boolean>;
  readonly kind: 'upstash' | 'memory';
}

// Lua runs atomically inside Redis, so two people saving at once cannot overwrite each other.
const CAS_SCRIPT = `
local v = redis.call('GET', KEYS[2])
if (v or '0') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2], tostring(tonumber(ARGV[1]) + 1), 'EX', ARGV[3])
return 1`;

export function upstashStore(url: string, token: string, fetcher: typeof fetch = fetch): Store {
  async function cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args.map(String)),
      cache: 'no-store',
    });
    const data = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok || data.error) throw new Error(`Upstash: ${data.error ?? res.status}`);
    return data.result;
  }
  return {
    kind: 'upstash',
    async get(key) {
      return ((await cmd(['GET', key])) as string | null) ?? null;
    },
    async compareAndSet(docKey, verKey, expectVersion, value, ttlSec) {
      return Number(await cmd(['EVAL', CAS_SCRIPT, 2, docKey, verKey, expectVersion, value, ttlSec])) === 1;
    },
  };
}

export function memoryStore(now: () => number = Date.now): Store {
  const data = new Map<string, { value: string; expires: number }>();
  const read = (k: string) => {
    const e = data.get(k);
    if (!e) return null;
    if (e.expires <= now()) {
      data.delete(k);
      return null;
    }
    return e.value;
  };
  return {
    kind: 'memory',
    async get(key) {
      return read(key);
    },
    async compareAndSet(docKey, verKey, expectVersion, value, ttlSec) {
      if ((read(verKey) ?? '0') !== String(expectVersion)) return false;
      const expires = now() + ttlSec * 1000;
      data.set(docKey, { value, expires });
      data.set(verKey, { value: String(expectVersion + 1), expires });
      return true;
    },
  };
}

const g = globalThis as unknown as { __meetupStore?: Store };

/** The store for this server (one per process; survives dev hot-reloads). */
export function getStore(): Store {
  if (g.__meetupStore) return g.__meetupStore;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  g.__meetupStore = url && token ? upstashStore(url, token) : memoryStore();
  return g.__meetupStore;
}
