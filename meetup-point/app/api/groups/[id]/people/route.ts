import { body, handle } from '@/lib/groupHttp.server';
import { addPerson } from '@/lib/groups.server';
import { getStore } from '@/lib/store.server';

/** POST /api/groups/:id/people {name, mode, location?} → join the group; returns your edit token. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => addPerson(getStore(), id, await body(req)));
}
