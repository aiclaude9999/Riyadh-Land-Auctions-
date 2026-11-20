/**
 * Shared groups: one JSON document per group (+ a version key for safe concurrent writes).
 * Tokens are random; only their SHA-256 hashes are stored. Anyone with the link can read the group,
 * add themselves and vote; a person's token edits that person; the admin token edits everything.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { LatLng } from './geo';
import { GROUP_TTL_DAYS, MAX_GROUP_PEOPLE, type GroupPerson, type GroupView } from './groupTypes';
import type { TravelMode } from './people';
import type { RecommendResponse } from './recommendTypes';
import type { Store } from './store.server';

const TTL_SEC = GROUP_TTL_DAYS * 86_400;
const ID_RE = /^[A-Za-z0-9]{10}$/;
const PERSON_ID_RE = /^[A-Za-z0-9]{8}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export class GroupError extends Error {
  constructor(
    public status: number,
    public code: 'bad_request' | 'not_found' | 'forbidden' | 'full' | 'busy',
    message: string,
  ) {
    super(message);
  }
}

interface StoredPerson extends GroupPerson {
  tokenHash: string;
}

interface GroupDoc {
  id: string;
  createdAt: string;
  adminHash: string;
  people: StoredPerson[];
  /** hash(voter) → venue id */
  votes: Record<string, string>;
  results: RecommendResponse | null;
  resultsAt: string | null;
}

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function randomId(len: number): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
const newToken = () => randomBytes(18).toString('base64url');
const docKey = (id: string) => `meetup:g:${id}`;
const verKey = (id: string) => `meetup:g:${id}:v`;

export function validId(id: string): boolean {
  return ID_RE.test(id);
}

/** Cleans one person coming from the browser. */
export function cleanPerson(raw: unknown): Omit<GroupPerson, 'id'> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 40) : '';
  const mode: TravelMode = r.mode === 'metro' ? 'metro' : 'car';
  let location: LatLng | null = null;
  const loc = r.location as { lat?: unknown; lng?: unknown } | null | undefined;
  if (loc && typeof loc === 'object') {
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat - 24.7) > 2 || Math.abs(lng - 46.7) > 2) throw new GroupError(400, 'bad_request', 'location must be near Riyadh');
    location = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  }
  const districtId = typeof r.districtId === 'string' && /^d\d{1,4}$/.test(r.districtId) ? r.districtId : null;
  return { name, mode, location, districtId };
}

function view(doc: GroupDoc, version: number): GroupView {
  const counts: Record<string, number> = {};
  for (const v of Object.values(doc.votes)) counts[v] = (counts[v] ?? 0) + 1;
  return {
    id: doc.id,
    version,
    createdAt: doc.createdAt,
    expiresAt: new Date(Date.parse(doc.createdAt) + TTL_SEC * 1000).toISOString(),
    people: doc.people.map(({ tokenHash: _t, ...p }) => p),
    votes: counts,
    results: doc.results,
    resultsAt: doc.resultsAt,
  };
}

async function load(store: Store, id: string): Promise<{ doc: GroupDoc; version: number }> {
  if (!validId(id)) throw new GroupError(404, 'not_found', 'group not found');
  const [raw, ver] = await Promise.all([store.get(docKey(id)), store.get(verKey(id))]);
  if (!raw) throw new GroupError(404, 'not_found', 'group not found (links expire after 7 days)');
  return { doc: JSON.parse(raw) as GroupDoc, version: Number(ver ?? '0') };
}

/** Read–change–write with retries; the version check makes concurrent edits safe. */
async function mutate<T>(store: Store, id: string, change: (doc: GroupDoc) => T): Promise<{ result: T; view: GroupView }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { doc, version } = await load(store, id);
    const result = change(doc);
    if (await store.compareAndSet(docKey(id), verKey(id), version, JSON.stringify(doc), TTL_SEC)) return { result, view: view(doc, version + 1) };
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
  throw new GroupError(409, 'busy', 'the group is busy, try again');
}

const isAdmin = (doc: GroupDoc, token?: string | null) => !!token && hash(token) === doc.adminHash;
function canEdit(doc: GroupDoc, personId: string, token?: string | null) {
  const p = doc.people.find((x) => x.id === personId);
  if (!p) throw new GroupError(404, 'not_found', 'person not found');
  if (!token || (hash(token) !== p.tokenHash && !isAdmin(doc, token))) throw new GroupError(403, 'forbidden', 'not allowed to change this person');
  return p;
}

export async function createGroup(store: Store, peopleRaw: unknown, now = new Date()) {
  const list = Array.isArray(peopleRaw) ? peopleRaw : [];
  if (list.length < 1 || list.length > MAX_GROUP_PEOPLE) throw new GroupError(400, 'bad_request', `need 1–${MAX_GROUP_PEOPLE} people`);
  const id = randomId(10);
  const adminToken = newToken();
  const tokens: { id: string; token: string }[] = [];
  const people: StoredPerson[] = list.map((raw) => {
    const token = newToken();
    const pid = randomId(8);
    tokens.push({ id: pid, token });
    return { id: pid, ...cleanPerson(raw), tokenHash: hash(token) };
  });
  const doc: GroupDoc = { id, createdAt: now.toISOString(), adminHash: hash(adminToken), people, votes: {}, results: null, resultsAt: null };
  if (!(await store.compareAndSet(docKey(id), verKey(id), 0, JSON.stringify(doc), TTL_SEC))) throw new GroupError(409, 'busy', 'try again');
  return { id, adminToken, people: tokens, group: view(doc, 1) };
}

export async function getGroup(store: Store, id: string): Promise<GroupView> {
  const { doc, version } = await load(store, id);
  return view(doc, version);
}

/** Cheap check used by polling: only the version number. */
export async function groupVersion(store: Store, id: string): Promise<number> {
  if (!validId(id)) throw new GroupError(404, 'not_found', 'group not found');
  const v = await store.get(verKey(id));
  if (v == null) throw new GroupError(404, 'not_found', 'group not found');
  return Number(v);
}

export async function addPerson(store: Store, id: string, raw: unknown) {
  const token = newToken();
  const { result: pid, view: v } = await mutate(store, id, (doc) => {
    if (doc.people.length >= MAX_GROUP_PEOPLE) throw new GroupError(409, 'full', `the group already has ${MAX_GROUP_PEOPLE} people`);
    const pid = randomId(8);
    doc.people.push({ id: pid, ...cleanPerson(raw), tokenHash: hash(token) });
    return pid;
  });
  return { id: pid, token, group: v };
}

export async function updatePerson(store: Store, id: string, personId: string, token: string | null, raw: unknown) {
  if (!PERSON_ID_RE.test(personId)) throw new GroupError(404, 'not_found', 'person not found');
  const { view: v } = await mutate(store, id, (doc) => {
    const p = canEdit(doc, personId, token);
    const r = (raw ?? {}) as Record<string, unknown>;
    const c = cleanPerson({ name: p.name, mode: p.mode, location: p.location, districtId: p.districtId, ...r });
    Object.assign(p, c);
  });
  return v;
}

export async function removePerson(store: Store, id: string, personId: string, token: string | null) {
  const { view: v } = await mutate(store, id, (doc) => {
    canEdit(doc, personId, token);
    doc.people = doc.people.filter((x) => x.id !== personId);
  });
  return v;
}

/** Admin only: stores the latest search result for everyone. Clears votes for places no longer shown. */
export async function saveResults(store: Store, id: string, token: string | null, results: RecommendResponse, now = new Date()) {
  const { view: v } = await mutate(store, id, (doc) => {
    if (!isAdmin(doc, token)) throw new GroupError(403, 'forbidden', 'only the organiser can search');
    doc.results = results;
    doc.resultsAt = now.toISOString();
    const ids = new Set(results.results.slice(0, 3).map((r) => r.venue.id));
    for (const [k, venue] of Object.entries(doc.votes)) if (!ids.has(venue)) delete doc.votes[k];
  });
  return v;
}

export async function loadForSearch(store: Store, id: string, token: string | null) {
  const { doc } = await load(store, id);
  if (!isAdmin(doc, token)) throw new GroupError(403, 'forbidden', 'only the organiser can search');
  return doc.people;
}

/** One vote per browser (voter id); `venueId` null removes the vote. Only the top 3 can be voted on. */
export async function vote(store: Store, id: string, voter: unknown, venueId: unknown) {
  if (typeof voter !== 'string' || voter.length < 16 || voter.length > 64) throw new GroupError(400, 'bad_request', 'bad voter id');
  const { view: v } = await mutate(store, id, (doc) => {
    const key = hash(voter);
    if (venueId == null) {
      delete doc.votes[key];
      return;
    }
    const top = doc.results?.results.slice(0, 3).map((r) => r.venue.id) ?? [];
    if (typeof venueId !== 'string' || !top.includes(venueId)) throw new GroupError(400, 'bad_request', 'you can vote for one of the top 3 places');
    doc.votes[key] = venueId;
  });
  return v;
}
