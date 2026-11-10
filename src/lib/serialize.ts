import { Prisma } from '@prisma/client';

/** JSON-safe conversion: Decimal → number, Date → ISO string (recursive). */
export function toJson(v: any): any {
  if (v == null) return v;
  if (v instanceof Prisma.Decimal) return v.toNumber();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(toJson);
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = toJson(x);
    return o;
  }
  return v;
}
