/**
 * Minimal reader for common OpenStreetMap opening_hours: "24/7", "Mo-Su 17:00-01:00",
 * "Sa-Th 09:00-03:00; Fr 14:00-03:00". Anything else → null (unknown). Times past midnight are
 * handled ("17:00-01:00" means until 1 am the next day). Only ~1% of places have hours.
 */
const DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

function dayList(spec: string): number[] | null {
  const out: number[] = [];
  for (const part of spec.toLowerCase().split(',')) {
    const m = part.trim().match(/^([a-z]{2})(?:-([a-z]{2}))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    if (a < 0 || b < 0) return null;
    for (let d = a; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === b) break;
    }
  }
  return out;
}

const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Is the place open on Riyadh day `day` (0 = Sunday) at `minute` (since midnight)? null = unknown. */
export function isOpen(hours: string | undefined, day: number, minute: number): boolean | null {
  if (!hours) return null;
  const h = hours.trim();
  if (h === '24/7') return true;
  let known = false;
  for (const rule of h.split(';')) {
    const m = rule.trim().match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)?\s*((?:\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:,\s*)?)+)$/);
    if (!m) return null;
    const days = m[1] ? dayList(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    known = true;
    for (const range of m[2].split(',')) {
      const [s, e] = range.trim().split('-').map(mins);
      const end = e <= s ? e + 24 * 60 : e;
      // today's range, or yesterday's range running past midnight
      if (days.includes(day) && minute >= s && minute < end) return true;
      if (days.includes((day + 6) % 7) && end > 24 * 60 && minute < end - 24 * 60) return true;
    }
  }
  return known ? false : null;
}
