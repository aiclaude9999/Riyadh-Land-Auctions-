import { NextResponse } from 'next/server';
import { addReport, getCalibration } from '@/lib/calibration.server';
import { getStore } from '@/lib/store.server';

/** POST /api/feedback {mode: 'car'|'metro', estimated, actual} — "how long did it really take?" */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { mode?: unknown; estimated?: unknown; actual?: unknown };
  const ok = await addReport(getStore(), b.mode, b.estimated, b.actual).catch(() => false);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

/** GET /api/feedback → the current learned corrections (for transparency). */
export async function GET() {
  return NextResponse.json(await getCalibration(getStore()));
}
