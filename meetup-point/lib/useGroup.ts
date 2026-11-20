'use client';

/**
 * Shared-group mode. When the page URL has ?g=<id>, the people list lives on the server:
 * - every 8 s (only while the tab is visible) we ask "anything new?" (cheap version check);
 * - edits to people you may edit are sent after a short pause (typing does not flood the server);
 * - while your own edit is on its way, the server copy does not overwrite it.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { ApiError, forgetCreds, fromWire, groupApi, loadCreds, saveCreds } from './groupClient';
import type { GroupCreds, GroupView } from './groupTypes';
import { peopleReducer, type PeopleAction, type PeopleState, type Person } from './people';

const POLL_MS = 8000;
const PATCH_DELAY_MS = 600;

export interface GroupApi {
  id: string | null;
  view: GroupView | null;
  creds: GroupCreds | null;
  isAdmin: boolean;
  error: 'missing' | 'sync' | null;
  busy: boolean;
  canEdit: (personId: string) => boolean;
  /** dispatch wrapper: applies locally and syncs with the group */
  act: (a: PeopleAction) => void;
  start: () => Promise<void>;
  join: () => Promise<void>;
  leave: () => void;
  search: (body: unknown) => Promise<void>;
  vote: (venueId: string | null) => Promise<void>;
  myVote: string | null;
}

export function useGroup(state: PeopleState, dispatch: Dispatch<PeopleAction>): GroupApi {
  const [id, setId] = useState<string | null>(null);
  const [view, setView] = useState<GroupView | null>(null);
  const [creds, setCreds] = useState<GroupCreds | null>(null);
  const [error, setError] = useState<'missing' | 'sync' | null>(null);
  const [busy, setBusy] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirty = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const versionRef = useRef<number | undefined>(undefined);

  /** Take the server's people, but keep entries that have an edit on its way. */
  const applyView = useCallback(
    (v: GroupView) => {
      versionRef.current = v.version;
      setView(v);
      const local = new Map(stateRef.current.people.map((p) => [p.id, p]));
      const people: Person[] = v.people.map((sp) => (dirty.current.has(sp.id) && local.get(sp.id) ? local.get(sp.id)! : fromWire(sp)));
      dispatch({ type: 'replace', people });
    },
    [dispatch],
  );

  // open a group from the link
  useEffect(() => {
    const gid = new URLSearchParams(window.location.search).get('g');
    if (!gid) return;
    setId(gid);
    const c = loadCreds(gid);
    setCreds(c);
    saveCreds(gid, c);
    groupApi
      .get(gid)
      .then((r) => r.group && applyView(r.group))
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? 'missing' : 'sync'));
  }, [applyView]);

  // polling
  useEffect(() => {
    if (!id || error === 'missing') return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await groupApi.get(id, versionRef.current);
        setError(null);
        if (r.group) applyView(r.group);
      } catch (e) {
        setError(e instanceof ApiError && e.status === 404 ? 'missing' : 'sync');
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id, error, applyView]);

  const tokenFor = useCallback((pid: string) => creds?.people[pid] ?? creds?.adminToken, [creds]);
  const canEdit = useCallback((pid: string) => !id || !!creds?.adminToken || !!creds?.people[pid], [id, creds]);

  const act = useCallback(
    (a: PeopleAction) => {
      if (!id) return dispatch(a);
      if (a.type === 'add' || a.type === 'replace' || a.type === 'addWithId') return; // handled by join()
      const pid = a.id;
      if (!canEdit(pid)) return;
      const token = tokenFor(pid);
      if (!token) return;
      if (a.type === 'remove') {
        dispatch({ ...a, force: true });
        groupApi.remove(id, pid, token).then((r) => applyView(r.group)).catch(() => setError('sync'));
        return;
      }
      dispatch(a);
      const next = peopleReducer(stateRef.current, a).people.find((p) => p.id === pid);
      if (!next) return;
      clearTimeout(dirty.current.get(pid));
      dirty.current.set(
        pid,
        setTimeout(() => {
          const latest = stateRef.current.people.find((p) => p.id === pid) ?? next;
          groupApi
            .update(id, pid, token, latest)
            .then((r) => {
              dirty.current.delete(pid);
              applyView(r.group);
            })
            .catch(() => {
              dirty.current.delete(pid);
              setError('sync');
            });
        }, PATCH_DELAY_MS),
      );
    },
    [id, dispatch, canEdit, tokenFor, applyView],
  );

  /** Organiser: turn the current list into a shared group and put its id in the address bar. */
  const start = useCallback(async () => {
    setBusy(true);
    try {
      const r = await groupApi.create(stateRef.current.people);
      const c: GroupCreds = { adminToken: r.adminToken, people: Object.fromEntries(r.people.map((p) => [p.id, p.token])), voter: crypto.randomUUID() };
      saveCreds(r.id, c);
      setCreds(c);
      setId(r.id);
      const url = new URL(window.location.href);
      url.searchParams.set('g', r.id);
      window.history.replaceState(null, '', url);
      applyView(r.group);
    } finally {
      setBusy(false);
    }
  }, [applyView]);

  /** Friend: add yourself as a new person. */
  const join = useCallback(async () => {
    if (!id || !creds) return;
    setBusy(true);
    try {
      const blank: Person = { id: 'new', name: '', mode: 'car', location: null, address: null, locationSource: null };
      const r = await groupApi.join(id, blank);
      const c = { ...creds, people: { ...creds.people, [r.id]: r.token } };
      saveCreds(id, c);
      setCreds(c);
      applyView(r.group);
    } finally {
      setBusy(false);
    }
  }, [id, creds, applyView]);

  const leave = useCallback(() => {
    if (id) forgetCreds(id);
    const url = new URL(window.location.href);
    url.searchParams.delete('g');
    window.history.replaceState(null, '', url);
    setId(null);
    setView(null);
    setCreds(null);
    setError(null);
  }, [id]);

  const search = useCallback(
    async (body: unknown) => {
      if (!id || !creds?.adminToken) return;
      const r = await groupApi.search(id, creds.adminToken, body);
      applyView(r.group);
    },
    [id, creds, applyView],
  );

  const vote = useCallback(
    async (venueId: string | null) => {
      if (!id || !creds) return;
      setMyVote(venueId);
      try {
        localStorage.setItem(`meetup.vote.${id}`, venueId ?? '');
      } catch {
        /* ignore */
      }
      const r = await groupApi.vote(id, creds.voter, venueId);
      applyView(r.group);
    },
    [id, creds, applyView],
  );

  useEffect(() => {
    if (!id) return;
    try {
      setMyVote(localStorage.getItem(`meetup.vote.${id}`) || null);
    } catch {
      /* ignore */
    }
  }, [id]);

  return { id, view, creds, isAdmin: !!creds?.adminToken, error, busy, canEdit, act, start, join, leave, search, vote, myVote };
}
