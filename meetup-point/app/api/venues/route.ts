import { NextResponse } from 'next/server';
import { allVenues } from '@/lib/deps.server';
import { toCompact } from '@/lib/venueLayer';

// ~10k places ≈ 770 KB of JSON (≈ 280 KB compressed). Hosting (Vercel) compresses it automatically;
// don't gzip here: Next.js removes our Content-Encoding header, which breaks the reply in browsers.
const body = JSON.stringify(allVenues.map(toCompact));

/** GET /api/venues → every known café/restaurant in compact form (for the map layer). Cached by browsers for a day. */
export function GET() {
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
}
