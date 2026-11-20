'use client';

import type { Dispatch } from 'react';
import PersonCard from './PersonCard';
import { t } from '@/lib/i18n';
import type { District } from '@/lib/districts';
import type { Station } from '@/lib/metro';
import { MAX_PEOPLE, type PeopleAction, type PeopleState } from '@/lib/people';

interface Props {
  state: PeopleState;
  dispatch: Dispatch<PeopleAction>;
  stations: Station[];
  pickingId: string | null;
  onPick: (id: string) => void;
  districts: District[];
  onDistrict: (personId: string, d: District) => void;
}

export default function PeoplePanel({ state, dispatch, stations, pickingId, onPick, districts, onDistrict }: Props) {
  const { people } = state;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t.people} <span className="font-normal normal-case">({t.peopleCount(people.length, MAX_PEOPLE)})</span>
        </h2>
        <button
          type="button"
          onClick={() => dispatch({ type: 'add' })}
          disabled={people.length >= MAX_PEOPLE}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          + {t.addPerson}
        </button>
      </div>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {people.map((person, index) => (
          <PersonCard
            key={person.id}
            person={person}
            index={index}
            canRemove={people.length > 2}
            dispatch={dispatch}
            stations={stations}
            picking={pickingId === person.id}
            onPick={() => onPick(person.id)}
            districts={districts}
            onDistrict={(d) => onDistrict(person.id, d)}
          />
        ))}
      </ol>
      <p className="px-4 pb-3 text-xs text-slate-400">{t.dragHint}</p>

    </div>
  );
}
