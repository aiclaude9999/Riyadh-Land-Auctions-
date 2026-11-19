import { NextResponse } from 'next/server';
import { TtlCache } from '@/lib/cache';
import { autocomplete, MissingKeyError, type Suggestion } from '@/lib/google.server';

const cache = new TtlCache<Suggestion[]>();

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const input = (params.get('q') ?? '').trim().slice(0, 120);
  const sessionToken = (params.get('session') ?? '').slice(0, 64);
  if (input.length < 2) return NextResponse.json({ suggestions: [] });

  const key = input.toLowerCase();
  const cached = cache.get(key);
  if (cached) return NextResponse.json({ suggestions: cached, cached: true });

  try {
    const suggestions = await autocomplete(input, sessionToken);
    cache.set(key, suggestions);
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof MissingKeyError) return NextResponse.json({ error: 'no_key' }, { status: 503 });
    console.error(e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
