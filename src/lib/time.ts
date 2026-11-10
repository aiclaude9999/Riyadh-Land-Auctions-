export const TZ = 'Asia/Riyadh';
/** Riyadh is UTC+3 all year (no DST). */
export const RIYADH_OFFSET_MIN = 180;

/** Parse "YYYY-MM-DD HH:MM[:SS]" given in UTC (no zone suffix). */
export function parseUtcNaive(s?: string | null): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return parseIso(s);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)));
}

/** Parse a local Riyadh wall-clock date+time into a UTC Date. */
export function parseRiyadhLocal(date?: string | null, time?: string | null): Date | null {
  if (!date) return null;
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!d) return null;
  const t = (time ?? '00:00:00').match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  const [h, mi, se] = t ? [+t[1], +t[2], +(t[3] ?? 0)] : [0, 0, 0];
  return new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], h, mi, se) - RIYADH_OFFSET_MIN * 60_000);
}

export function parseIso(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function fromEpochMs(n?: number | null): Date | null {
  if (n == null || !isFinite(n)) return null;
  return new Date(n);
}

/** Start / end of "today" in Riyadh, as UTC instants. */
export function riyadhDayBounds(now = new Date()): { start: Date; end: Date } {
  const local = new Date(now.getTime() + RIYADH_OFFSET_MIN * 60_000);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(startLocal - RIYADH_OFFSET_MIN * 60_000);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
});
export function formatRiyadh(d?: Date | string | null): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  return isNaN(x.getTime()) ? '—' : fmt.format(x);
}
