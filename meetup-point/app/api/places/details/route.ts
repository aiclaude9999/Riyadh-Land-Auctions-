import { NextResponse } from 'next/server';
import { TtlCache } from '@/lib/cache';
import { MissingKeyError, placeLocation, type PlaceLocation } from '@/lib/google.server';

const cache = new TtlCache<PlaceLocation>();

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const placeId = (params.get('id') ?? '').trim();
  const sessionToken = (params.get('session') ?? '').slice(0, 64);
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const cached = cache.get(placeId);
  if (cached) return NextResponse.json({ place: cached, cached: true });

  try {
    const place = await placeLocation(placeId, sessionToken);
    cache.set(placeId, place);
    return NextResponse.json({ place });
  } catch (e) {
    if (e instanceof MissingKeyError) return NextResponse.json({ error: 'no_key' }, { status: 503 });
    console.error(e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
