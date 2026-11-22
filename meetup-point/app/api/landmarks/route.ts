import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const body = readFileSync(path.join(process.cwd(), 'data', 'landmarks-riyadh.json'), 'utf8');

/** GET /api/landmarks → malls, hotels, universities, hospitals, parks… and well-known areas (for the search). */
export function GET() {
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
}
