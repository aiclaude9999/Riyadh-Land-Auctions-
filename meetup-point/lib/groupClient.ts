'use client';

/** Browser side of shared groups: API calls + tokens kept in localStorage (never sent to other people). */
import type { GroupCreds, GroupPerson, GroupView } from './groupTypes';
import type { Person } from './people';

const key = (id: string) => `meetup.group.${id}`;

export function loadCreds(id: string): GroupCreds {
  try {
    const raw = window.localStorage.getItem(key(id));
    if (raw) {
      const c = JSON.parse(raw) as GroupCreds;
      if (c && typeof c.voter === 'string' && c.people && typeof c.people === 'object') return c;
    }
  } catch {
    /* storage blocked */
  }
  return { people: {}, voter: crypto.randomUUID() };
}

export function saveCreds(id: string, c: GroupCreds) {
  try {
    window.localStorage.setItem(key(id), JSON.stringify(c));
  } catch {
    /* storage blocked: works for this visit only */
  }
}

export function forgetCreds(id: string) {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? `HTTP ${res.status}`);
  return data;
}

export const toWire = (p: Person) => ({ name: p.name, mode: p.mode, location: p.location, districtId: p.districtId ?? null, access: p.access ?? 'walk' });

export function fromWire(p: GroupPerson): Person {
  return { id: p.id, name: p.name, mode: p.mode, location: p.location, address: null, locationSource: p.location ? 'pin' : null, districtId: p.districtId, access: p.access ?? 'walk' };
}

export const groupApi = {
  create: (people: Person[]) =>
    call<{ id: string; adminToken: string; people: { id: string; token: string }[]; group: GroupView }>('POST', '/api/groups', { people: people.map(toWire) }),
  get: (id: string, since?: number) => call<{ group?: GroupView; unchanged?: boolean; version?: number }>('GET', `/api/groups/${id}${since != null ? `?since=${since}` : ''}`),
  join: (id: string, p: Person) => call<{ id: string; token: string; group: GroupView }>('POST', `/api/groups/${id}/people`, toWire(p)),
  update: (id: string, pid: string, token: string, p: Person) => call<{ group: GroupView }>('PATCH', `/api/groups/${id}/people/${pid}`, toWire(p), token),
  remove: (id: string, pid: string, token: string) => call<{ group: GroupView }>('DELETE', `/api/groups/${id}/people/${pid}`, undefined, token),
  search: (id: string, token: string, body: unknown) => call<{ group: GroupView }>('POST', `/api/groups/${id}/search`, body, token),
  vote: (id: string, voter: string, venueId: string | null) => call<{ group: GroupView }>('POST', `/api/groups/${id}/vote`, { voter, venueId }),
};
