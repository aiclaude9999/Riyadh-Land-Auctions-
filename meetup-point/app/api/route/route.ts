import { NextResponse } from 'next/server';
import { TtlCache } from '@/lib/cache';
import type { CarRoute } from '@/lib/directions';
import { osrmCarRoute } from '@/lib/osrm.server';

const cache = new TtlCache<CarRoute>(); // 10 min

const num = (v: string | null) => (v == null || v === '' ? NaN : Number(v));
const nearRiyadh = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat - 24.7) <= 2 && Math.abs(lng - 46.7) <= 2;

/** GET /api/route?from=lat,lng&to=lat,lng → car route (free OSRM, no live traffic). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const [fLat, fLng] = (q.get('from') ?? '').split(',').map((x) => num(x));
  const [tLat, tLng] = (q.get('to') ?? '').split(',').map((x) => num(x));
  if (!nearRiyadh(fLat, fLng) || !nearRiyadh(tLat, tLng)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const key = [fLat, fLng, tLat, tLng].map((x) => x.toFixed(5)).join(',');
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);
  try {
    const route = await osrmCarRoute({ lat: fLat, lng: fLng }, { lat: tLat, lng: tLng });
    cache.set(key, route);
    return NextResponse.json(route);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
