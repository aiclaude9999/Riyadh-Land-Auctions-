'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'compareIds';
const MAX = 4;
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };

/** Up to 4 assets picked for side-by-side comparison (kept in this browser). */
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(read()); }, []);
  const save = (next: string[]) => { setIds(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const toggle = (id: string) => save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX));
  return { ids, toggle, clear: () => save([]), has: (id: string) => ids.includes(id) };
}

export function CompareBar({ ids, clear }: { ids: string[]; clear: () => void }) {
  if (!ids.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--card)] p-3 shadow-lg" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-sm">
        <span><b className="num">{ids.length}</b> / {MAX} للمقارنة</span>
        <div className="flex gap-2">
          <button className="btn" onClick={clear}>مسح</button>
          <Link href={`/compare?ids=${ids.join(',')}`} className="btn bg-brand-600 text-white">قارن الآن</Link>
        </div>
      </div>
    </div>
  );
}
