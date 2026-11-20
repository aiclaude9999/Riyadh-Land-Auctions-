import { body, handle } from '@/lib/groupHttp.server';
import { vote } from '@/lib/groups.server';
import { getStore } from '@/lib/store.server';

/** POST /api/groups/:id/vote {voter, venueId|null} — one vote per browser among the top 3. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const b = (await body(req)) as { voter?: unknown; venueId?: unknown };
    return { group: await vote(getStore(), id, b.voter, b.venueId ?? null) };
  });
}
