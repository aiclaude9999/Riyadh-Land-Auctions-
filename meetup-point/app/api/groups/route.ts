import { body, handle } from '@/lib/groupHttp.server';
import { createGroup } from '@/lib/groups.server';
import { getStore } from '@/lib/store.server';

/** POST /api/groups {people:[…]} → new group; returns the organiser token and one token per person. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = (await body(req)) as { people?: unknown };
    const created = await createGroup(getStore(), b.people);
    return { ...created, group: { ...created.group, storage: getStore().kind } };
  });
}
