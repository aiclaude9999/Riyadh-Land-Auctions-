'use client';

import type { Dispatch } from 'react';
import PersonCard from './PersonCard';
import { useT } from './LocaleProvider';
import type { District } from '@/lib/districts';
import type { PlaceHit } from '@/lib/places';
import type { Station } from '@/lib/metro';
import { MAX_PEOPLE, type PeopleAction, type PeopleState } from '@/lib/people';

interface Props {
  state: PeopleState;
  dispatch: Dispatch<PeopleAction>;
  stations: Station[];
  pickingId: string | null;
  onPick: (id: string) => void;
  districts: District[];
  onPlace: (personId: string, hit: PlaceHit) => void;
  /** shared group: who may edit which entry, and how "add" works */
  canEdit?: (personId: string) => boolean;
  onAdd?: () => void;
  addLabel?: string;
  minPeople?: number;
}

export default function PeoplePanel({ state, dispatch, stations, pickingId, onPick, districts, onPlace, canEdit = () => true, onAdd, addLabel, minPeople = 2 }: Props) {
  const t = useT();
  const { people } = state;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t.people} <span className="font-normal normal-case">({t.peopleCount(people.length, MAX_PEOPLE)})</span>
        </h2>
        <button
          type="button"
          onClick={() => (onAdd ? onAdd() : dispatch({ type: 'add' }))}
          disabled={people.length >= MAX_PEOPLE}
          className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-brand-dark shadow-card ring-1 ring-brand/30 hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          + {addLabel ?? t.addPerson}
        </button>
      </div>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {people.map((person, index) => (
          <PersonCard
            key={person.id}
            person={person}
            index={index}
            canRemove={people.length > minPeople}
            readOnly={!canEdit(person.id)}
            dispatch={dispatch}
            stations={stations}
            picking={pickingId === person.id}
            onPick={() => onPick(person.id)}
            districts={districts}
            onPlace={(hit) => onPlace(person.id, hit)}
          />
        ))}
      </ol>
      <p className="px-4 pb-3 text-xs text-slate-400">{t.dragHint}</p>

    </div>
  );
}
