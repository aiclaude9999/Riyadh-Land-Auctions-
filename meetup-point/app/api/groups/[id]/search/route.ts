import { bearer, body, handle } from '@/lib/groupHttp.server';
import { recommendDeps } from '@/lib/deps.server';
import { GroupError, loadForSearch, saveResults } from '@/lib/groups.server';
import { BadRequest, parseRequest, recommend } from '@/lib/recommend.server';
import { getStore } from '@/lib/store.server';

/**
 * POST /api/groups/:id/search (organiser only) {venueType, departAt?, filters?, prefs?}
 * Runs the normal search on the group's saved people and shares the result with everyone.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const store = getStore();
    const token = bearer(req);
    const people = await loadForSearch(store, id, token);
    const b = (await body(req)) as Record<string, unknown>;
    let request;
    try {
      request = parseRequest({ ...b, people: people.map((p) => ({ name: p.name, mode: p.mode, location: p.location })) });
    } catch (e) {
      if (e instanceof BadRequest) throw new GroupError(400, 'bad_request', e.message);
      throw e;
    }
    const results = await recommend(request, recommendDeps());
    return { group: await saveResults(store, id, token, results) };
  });
}
