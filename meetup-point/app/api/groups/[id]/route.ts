import { handle } from '@/lib/groupHttp.server';
import { getGroup, groupVersion } from '@/lib/groups.server';
import { getStore } from '@/lib/store.server';

/** GET /api/groups/:id[?since=version] → the group, or {unchanged:true} when nothing changed (cheap polling). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const since = new URL(req.url).searchParams.get('since');
  return handle(async () => {
    if (since != null) {
      const v = await groupVersion(getStore(), id);
      if (String(v) === since) return { unchanged: true, version: v };
    }
    return { group: { ...(await getGroup(getStore(), id)), storage: getStore().kind } };
  });
}
