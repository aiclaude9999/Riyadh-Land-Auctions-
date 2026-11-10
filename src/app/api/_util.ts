import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { toJson } from '@/lib/serialize';

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(toJson(data), init);

export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e: any) {
      logger.error({ err: String(e?.message ?? e) }, 'api error');
      return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
  };
}
