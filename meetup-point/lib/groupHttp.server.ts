import { NextResponse } from 'next/server';
import { GroupError } from './groups.server';

/** Bearer token from the request (person or organiser token). */
export const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

export async function body(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 20_000) throw new GroupError(413, 'bad_request', 'request too large');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new GroupError(400, 'bad_request', 'invalid JSON');
  }
}

/** Runs a handler and turns GroupError into a JSON error response. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof GroupError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: 'upstream', message: 'Something went wrong. Try again.' }, { status: 502 });
  }
}
