'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/** YYYY-MM-DD of a date in Riyadh time */
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const thisMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 7);

interface Item { id: string; title: string; status: string; startAt: string | null; endAt: string | null; hasLand: boolean; saved: { id: string } | null }

/** Month view: which auctions open (🟢) and close (🔴) on each day. */
export default function CalendarPage() {
  const [month, setMonth] = useState(thisMonth());
  const [geo, setGeo] = useState('riyadh_city');
  const [items, setItems] = useState<Item[] | null>(null);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    fetch(`/api/calendar?month=${month}&geo=${geo}`).then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => setItems([]));
  }, [month, geo]);

  const byDay = useMemo(() => {
    const m = new Map<string, { open: Item[]; close: Item[] }>();
    const get = (k: string) => m.get(k) ?? (m.set(k, { open: [], close: [] }), m.get(k)!);
    items?.forEach((a) => {
      if (a.startAt) get(dayKey(a.startAt)).open.push(a);
      if (a.endAt) get(dayKey(a.endAt)).close.push(a);
    });
    return m;
  }, [items]);

  const [y, mo] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (d: number) => { const t = new Date(Date.UTC(y, mo - 1 + d, 1)); setMonth(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`); setDay(null); };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const sel = day ? byDay.get(day) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">تقويم المزادات</h1>
          <p className="muted text-sm">🟢 يفتح · 🔴 يغلق (بتوقيت الرياض). اضغط على يوم لعرض مزاداته.</p>
        </div>
        <div className="card flex p-1 text-sm">
          {[['riyadh_city', 'مدينة الرياض'], ['riyadh_region', 'منطقة الرياض'], ['all', 'كل المملكة']].map(([v, l]) => (
            <button key={v} onClick={() => setGeo(v)} className={`rounded-lg px-3 py-1.5 font-medium ${geo === v ? 'bg-brand-600 text-white' : 'muted'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button className="btn" onClick={() => shift(-1)}>→ الشهر السابق</button>
        <b>{MONTHS[mo - 1]} {y}</b>
        <button className="btn" onClick={() => shift(1)}>الشهر التالي ←</button>
      </div>
      <div className="card overflow-x-auto p-2">
        <div className="grid min-w-[560px] grid-cols-7 gap-1 text-xs">
          {DAYS.map((d) => <div key={d} className="muted p-1 text-center font-semibold">{d}</div>)}
          {cells.map((k, i) => {
            if (!k) return <div key={'e' + i} />;
            const e = byDay.get(k);
            return (
              <button key={k} onClick={() => setDay(k)} className={`min-h-[64px] rounded-lg border p-1 text-right align-top ${day === k ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40' : 'border-[var(--border)]'} ${k === today ? 'ring-1 ring-brand-600' : ''}`}>
                <div className="num font-semibold">{Number(k.slice(8))}</div>
                {e?.open.length ? <div className="num">🟢 {e.open.length}</div> : null}
                {e?.close.length ? <div className="num">🔴 {e.close.length}</div> : null}
              </button>
            );
          })}
        </div>
      </div>
      {!items && <div className="muted text-sm">جاري التحميل…</div>}
      {sel && (
        <div className="card space-y-3 p-4 text-sm">
          <h2 className="font-semibold">{Number(day!.slice(8))} {MONTHS[mo - 1]}</h2>
          {[['🟢 تفتح', sel.open], ['🔴 تغلق', sel.close]].map(([label, list]) => (list as Item[]).length > 0 && (
            <div key={label as string}>
              <div className="mb-1 font-semibold">{label as string} ({(list as Item[]).length})</div>
              <ul className="space-y-1">
                {(list as Item[]).map((a) => <li key={a.id}><Link href={`/auctions/${a.id}`} className="hover:text-brand-600">{a.saved ? '★ ' : ''}{a.hasLand ? '🟫 ' : ''}{a.title}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
