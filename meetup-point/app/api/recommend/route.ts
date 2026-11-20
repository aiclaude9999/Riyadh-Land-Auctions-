import { NextResponse } from 'next/server';
import { TtlCache } from '@/lib/cache';
import { recommendDeps } from '@/lib/deps.server';
import { hasServerKey } from '@/lib/google.server';
import { BadRequest, parseRequest, recommend } from '@/lib/recommend.server';
import type { RecommendError, RecommendResponse } from '@/lib/recommendTypes';

const cache = new TtlCache<RecommendResponse>(); // 10 min

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<RecommendError>({ error: 'bad_request', message: 'invalid JSON' }, { status: 400 });
  }
  try {
    const request = parseRequest(body);
    const key = JSON.stringify({
      ...request,
      people: request.people.map((p) => ({ m: p.mode, lat: p.location.lat.toFixed(4), lng: p.location.lng.toFixed(4) })),
      g: hasServerKey(),
    });
    const hit = cache.get(key);
    if (hit) return NextResponse.json(hit);
    const result = await recommend(request, recommendDeps());
    if (result.results.length) cache.set(key, result);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BadRequest) return NextResponse.json<RecommendError>({ error: 'bad_request', message: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json<RecommendError>({ error: 'upstream', message: 'A data service failed. Try again in a minute.' }, { status: 502 });
  }
}
