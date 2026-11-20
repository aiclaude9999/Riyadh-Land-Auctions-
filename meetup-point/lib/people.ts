import { inRiyadh, type LatLng } from './geo';

export type TravelMode = 'car' | 'metro';

export interface Person {
  id: string;
  name: string;
  mode: TravelMode;
  location: LatLng | null;
  /** Human-readable label: the searched address, or "Pinned on map". */
  address: string | null;
  locationSource: 'pin' | 'search' | 'district' | null;
  /** neighbourhood the point is in (label is written in the UI language) */
  districtId?: string | null;
}

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 6;

/** One marker / chip colour per slot, picked to stay distinct from the metro line colours. */
export const PERSON_COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2'] as const;

export interface PeopleState {
  people: Person[];
  nextId: number;
}

export type PeopleAction =
  | { type: 'add' }
  | { type: 'remove'; id: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'setMode'; id: string; mode: TravelMode }
  | { type: 'setLocation'; id: string; location: LatLng; address: string | null; source: 'pin' | 'search' | 'district'; districtId?: string | null }
  | { type: 'clearLocation'; id: string };

function newPerson(n: number): Person {
  return { id: `p${n}`, name: '', mode: 'car', location: null, address: null, locationSource: null };
}

export function initialPeopleState(): PeopleState {
  return { people: [newPerson(1), newPerson(2)], nextId: 3 };
}

export function peopleReducer(state: PeopleState, action: PeopleAction): PeopleState {
  const patch = (id: string, change: Partial<Person>): PeopleState => ({
    ...state,
    people: state.people.map((p) => (p.id === id ? { ...p, ...change } : p)),
  });

  switch (action.type) {
    case 'add':
      if (state.people.length >= MAX_PEOPLE) return state;
      return { people: [...state.people, newPerson(state.nextId)], nextId: state.nextId + 1 };
    case 'remove':
      if (state.people.length <= MIN_PEOPLE) return state;
      return { ...state, people: state.people.filter((p) => p.id !== action.id) };
    case 'rename':
      return patch(action.id, { name: action.name.slice(0, 40) });
    case 'setMode':
      return patch(action.id, { mode: action.mode });
    case 'setLocation':
      return patch(action.id, { location: action.location, address: action.address, locationSource: action.source, districtId: action.districtId ?? null });
    case 'clearLocation':
      return patch(action.id, { location: null, address: null, locationSource: null, districtId: null });
  }
}

/** Colour stays tied to the person's position in the list, so it is stable while editing. */
export function personColor(index: number): string {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

/** Name to show when the field is still empty: "Person 1", "Person 2", … */
export function displayName(person: Person, index: number, fallback: (n: number) => string = (n) => `Person ${n}`): string {
  return person.name.trim() || fallback(index + 1);
}

/** Letter on the person's pin: first letter of the name, or the number when unnamed. */
export function personInitial(person: Person, index: number): string {
  const n = person.name.trim();
  return n ? n[0].toUpperCase() : String(index + 1);
}

export type PersonIssue = 'missingLocation' | 'outsideRiyadh';

export function personIssues(person: Person): PersonIssue[] {
  if (!person.location) return ['missingLocation'];
  return inRiyadh(person.location) ? [] : ['outsideRiyadh'];
}

/** True when everyone has a location (names are optional; blanks fall back to "Person N"). */
export function isReady(state: PeopleState): boolean {
  return state.people.length >= MIN_PEOPLE && state.people.every((p) => p.location !== null);
}
