'use client';

import { useCallback, useEffect, useState } from 'react';
import { EMPTY_PREFS, sanitizePrefs, type Preferences } from './preferences';

const KEY = 'meetup.prefs.v1';

/** Preferences live only in this browser. Storage can be blocked (private mode) — the app still works. */
export function usePrefs(): [Preferences, (update: (p: Preferences) => Preferences) => void] {
  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setPrefs(sanitizePrefs(JSON.parse(raw)));
    } catch {
      /* storage unavailable: start empty */
    }
  }, []);

  const update = useCallback((fn: (p: Preferences) => Preferences) => {
    setPrefs((cur) => {
      const next = sanitizePrefs(fn(cur));
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* not saved, still used for this visit */
      }
      return next;
    });
  }, []);

  return [prefs, update];
}
