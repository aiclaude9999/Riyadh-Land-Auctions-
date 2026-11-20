import { describe, expect, it, vi } from 'vitest';
import { addPerson, createGroup, getGroup, GroupError, groupVersion, removePerson, saveResults, updatePerson, vote } from '@/lib/groups.server';
import type { RecommendResponse } from '@/lib/recommendTypes';
import { memoryStore, upstashStore } from '@/lib/store.server';

const sara = { name: 'Sara', mode: 'car', location: { lat: 24.81, lng: 46.58 } };
const fakeResults = (ids: string[]) => ({ results: ids.map((id) => ({ venue: { id } })), meta: {} }) as unknown as RecommendResponse;

describe('groups (memory store)', () => {
  it('creates a group; anyone can read it, tokens are never exposed', async () => {
    const store = memoryStore();
    const g = await createGroup(store, [sara, { name: 'Omar', mode: 'metro', location: null }]);
    expect(g.id).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(g.people).toHaveLength(2);
    const view = await getGroup(store, g.id);
    expect(view.people.map((p) => p.name)).toEqual(['Sara', 'Omar']);
    expect(JSON.stringify(view)).not.toContain('token');
    expect(view.version).toBe(1);
  });

  it('a friend joins, edits only their own entry; the organiser can edit anyone', async () => {
    const store = memoryStore();
    const g = await createGroup(store, [sara]);
    const joined = await addPerson(store, g.id, { name: 'Noura', mode: 'metro' });
    await updatePerson(store, g.id, joined.id, joined.token, { location: { lat: 24.7, lng: 46.7 } });
    await expect(updatePerson(store, g.id, g.people[0].id, joined.token, { name: 'hacked' })).rejects.toThrow(GroupError);
    await updatePerson(store, g.id, joined.id, g.adminToken, { name: 'Noura A.' });
    const view = await getGroup(store, g.id);
    expect(view.people[1]).toMatchObject({ name: 'Noura A.', mode: 'metro', location: { lat: 24.7, lng: 46.7 } });
    expect(view.version).toBe(4);
    await removePerson(store, g.id, joined.id, joined.token);
    expect((await getGroup(store, g.id)).people).toHaveLength(1);
  });

  it('rejects bad input, a 7th person and unknown groups', async () => {
    const store = memoryStore();
    await expect(createGroup(store, [{ ...sara, location: { lat: 21.5, lng: 39.2 } }])).rejects.toThrow(/near Riyadh/);
    const g = await createGroup(store, Array.from({ length: 6 }, () => sara));
    await expect(addPerson(store, g.id, sara)).rejects.toMatchObject({ code: 'full' });
    await expect(getGroup(store, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('only the organiser shares results; votes are one per browser, top 3 only', async () => {
    const store = memoryStore();
    const g = await createGroup(store, [sara]);
    await expect(saveResults(store, g.id, 'wrong', fakeResults(['a']))).rejects.toMatchObject({ status: 403 });
    await saveResults(store, g.id, g.adminToken, fakeResults(['a', 'b', 'c', 'd']));
    const v1 = 'x'.repeat(20);
    const v2 = 'y'.repeat(20);
    await vote(store, g.id, v1, 'a');
    await vote(store, g.id, v1, 'b'); // change of mind
    await vote(store, g.id, v2, 'b');
    await expect(vote(store, g.id, v2, 'd')).rejects.toThrow(/top 3/);
    expect((await getGroup(store, g.id)).votes).toEqual({ b: 2 });
    // a new search drops votes for places that are no longer in the top 3
    await saveResults(store, g.id, g.adminToken, fakeResults(['c', 'a', 'e']));
    expect((await getGroup(store, g.id)).votes).toEqual({});
  });

  it('concurrent joins do not overwrite each other', async () => {
    const store = memoryStore();
    const g = await createGroup(store, [sara]);
    await Promise.all(['A', 'B', 'C', 'D'].map((name) => addPerson(store, g.id, { name, mode: 'car' })));
    expect((await getGroup(store, g.id)).people.map((p) => p.name).sort()).toEqual(['A', 'B', 'C', 'D', 'Sara']);
    expect(await groupVersion(store, g.id)).toBe(5);
  });

  it('groups expire after 7 days', async () => {
    let now = Date.parse('2026-11-20T10:00:00Z');
    const store = memoryStore(() => now);
    const g = await createGroup(store, [sara]);
    now += 7 * 86_400_000 + 1000;
    await expect(getGroup(store, g.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('upstashStore', () => {
  it('sends Redis commands to the REST API with the token', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const args = JSON.parse(String(init!.body)) as string[];
      return new Response(JSON.stringify({ result: args[0] === 'GET' ? 'v' : 1 }), { status: 200 });
    });
    const s = upstashStore('https://example.upstash.io', 'TOKEN', fetcher as unknown as typeof fetch);
    expect(await s.get('k')).toBe('v');
    expect(await s.compareAndSet('doc', 'ver', 3, '{}', 60)).toBe(true);
    const [, init] = fetcher.mock.calls[1];
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
    const args = JSON.parse(String(init!.body));
    expect(args[0]).toBe('EVAL');
    expect(args.slice(2)).toEqual(['2', 'doc', 'ver', '3', '{}', '60']);
  });
  it('throws on Upstash errors', async () => {
    const fetcher = async () => new Response(JSON.stringify({ error: 'WRONGPASS' }), { status: 401 });
    await expect(upstashStore('u', 't', fetcher as unknown as typeof fetch).get('k')).rejects.toThrow(/WRONGPASS/);
  });
});
