import { bearer, body, handle } from '@/lib/groupHttp.server';
import { removePerson, updatePerson } from '@/lib/groups.server';
import { getStore } from '@/lib/store.server';

type Ctx = { params: Promise<{ id: string; pid: string }> };

/** PATCH /api/groups/:id/people/:pid (Bearer: that person's token or the organiser's) */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, pid } = await params;
  return handle(async () => ({ group: await updatePerson(getStore(), id, pid, bearer(req), await body(req)) }));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id, pid } = await params;
  return handle(async () => ({ group: await removePerson(getStore(), id, pid, bearer(req)) }));
}
