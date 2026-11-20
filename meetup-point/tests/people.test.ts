import { describe, expect, it } from 'vitest';
import { displayName, initialPeopleState, isReady, MAX_PEOPLE, peopleReducer, personIssues, type PeopleState } from '@/lib/people';

const olaya = { lat: 24.6911, lng: 46.6854 };
const apply = (s: PeopleState, ...actions: Parameters<typeof peopleReducer>[1][]) => actions.reduce(peopleReducer, s);

describe('peopleReducer', () => {
  it('starts with two empty car travellers', () => {
    const s = initialPeopleState();
    expect(s.people).toHaveLength(2);
    expect(s.people.every((p) => p.mode === 'car' && p.location === null)).toBe(true);
  });

  it('adds up to 6 people and no more', () => {
    let s = initialPeopleState();
    for (let i = 0; i < 10; i++) s = peopleReducer(s, { type: 'add' });
    expect(s.people).toHaveLength(MAX_PEOPLE);
    expect(new Set(s.people.map((p) => p.id)).size).toBe(MAX_PEOPLE);
  });

  it('never goes below 2 people', () => {
    const s = initialPeopleState();
    expect(peopleReducer(s, { type: 'remove', id: s.people[0].id }).people).toHaveLength(2);
  });

  it('does not reuse ids after removing', () => {
    let s = apply(initialPeopleState(), { type: 'add' });
    s = peopleReducer(s, { type: 'remove', id: 'p3' });
    s = peopleReducer(s, { type: 'add' });
    expect(s.people.map((p) => p.id)).toEqual(['p1', 'p2', 'p4']);
  });

  it('renames (max 40 chars), switches mode, sets and clears a location', () => {
    let s = apply(
      initialPeopleState(),
      { type: 'rename', id: 'p1', name: 'x'.repeat(60) },
      { type: 'setMode', id: 'p2', mode: 'metro' },
      { type: 'setLocation', id: 'p2', location: olaya, address: 'Olaya St', source: 'search' },
    );
    expect(s.people[0].name).toHaveLength(40);
    expect(s.people[1]).toMatchObject({ mode: 'metro', location: olaya, address: 'Olaya St', locationSource: 'search' });
    expect(s.people[0].location).toBeNull();
    s = peopleReducer(s, { type: 'clearLocation', id: 'p2' });
    expect(s.people[1]).toMatchObject({ location: null, address: null, locationSource: null });
  });
});

describe('helpers', () => {
  it('falls back to "Person N" for blank names', () => {
    const [a] = initialPeopleState().people;
    expect(displayName(a, 0)).toBe('Person 1');
    expect(displayName({ ...a, name: '  Sara ' }, 0)).toBe('Sara');
  });

  it('flags missing and out-of-Riyadh locations', () => {
    const [a] = initialPeopleState().people;
    expect(personIssues(a)).toEqual(['missingLocation']);
    expect(personIssues({ ...a, location: olaya })).toEqual([]);
    expect(personIssues({ ...a, location: { lat: 21.5433, lng: 39.1728 } })).toEqual(['outsideRiyadh']); // Jeddah
  });

  it('is ready only when everyone has a location', () => {
    let s = initialPeopleState();
    expect(isReady(s)).toBe(false);
    s = apply(s, { type: 'setLocation', id: 'p1', location: olaya, address: null, source: 'pin' });
    expect(isReady(s)).toBe(false);
    s = peopleReducer(s, { type: 'setLocation', id: 'p2', location: olaya, address: null, source: 'pin' });
    expect(isReady(s)).toBe(true);
  });
});

import { arMin } from '@/lib/i18n';
describe('arMin (Arabic counted minutes)', () => {
  it('uses the right form for each number', () => {
    expect([1, 2, 3, 10, 11, 25].map(arMin)).toEqual(['دقيقة واحدة', 'دقيقتان', '3 دقائق', '10 دقائق', '11 دقيقة', '25 دقيقة']);
  });
});
