'use client';
import { useEffect, useRef, useState } from 'react';

/** Before-you-bid checklist (keys are stored; labels can change without losing ticks). */
export const CHECKLIST: { key: string; label: string; hint?: string }[] = [
  { key: 'booklet', label: 'قرأت كراسة الشروط (العمولة، الضريبة، طريقة الدفع، المواعيد)' },
  { key: 'visit', label: 'زرت الموقع أو شاهدته على القمر الصناعي' },
  { key: 'deed', label: 'تحققت من الصك ورقم المخطط والقطعة', hint: 'عبر ناجز أو البورصة العقارية' },
  { key: 'notes', label: 'راجعت ملاحظات المزاد (شارع غير مسفلت، اختلاف مساحات…)' },
  { key: 'zoning', label: 'تحققت من الاستخدام ونظام البناء المسموح' },
  { key: 'whiteland', label: 'تحققت من رسوم الأراضي البيضاء إن كانت أرضاً كبيرة', hint: 'idlelands.momah.gov.sa' },
  { key: 'price', label: 'قارنت السعر بسعر الحي وحددت حدي الأعلى (الحاسبة)' },
  { key: 'money', label: 'جهزت العربون والتمويل وموعد السداد' },
  { key: 'register', label: 'سجلت في منصة المزاد قبل الموعد' },
];

const sar = (n: number) => Math.round(n).toLocaleString('en-US');

/** The owner's note, own maximum bid and checklist for one auction (saved in the database). */
export default function MyPlan({ auctionId, saved, onSaved }: { auctionId: string; saved: any; onSaved?: () => void }) {
  const [note, setNote] = useState('');
  const [maxBid, setMaxBid] = useState('');
  const [done, setDone] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const init = useRef<string | null>(null);
  useEffect(() => {
    if (init.current === auctionId) return; // don't overwrite while editing (page refreshes every minute)
    init.current = auctionId;
    setNote(saved?.note ?? '');
    setMaxBid(saved?.maxBid != null ? String(Math.round(Number(saved.maxBid))) : '');
    setDone(saved?.checklist ?? []);
  }, [auctionId, saved]);

  const save = async (body: Record<string, unknown>) => {
    setMsg('جاري الحفظ…');
    const r = await fetch(`/api/saved/${auctionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setMsg(r.ok ? 'تم الحفظ' : 'تعذر الحفظ — حاول مرة أخرى');
    if (r.ok) onSaved?.();
  };
  const tick = (key: string) => {
    const next = done.includes(key) ? done.filter((k) => k !== key) : [...done, key];
    setDone(next);
    save({ checklist: next });
  };

  return (
    <div className="card space-y-3 p-4 text-sm">
      <h2 className="font-semibold">خطتي لهذا المزاد</h2>
      <label htmlFor={`maxbid-${auctionId}`} className="flex flex-col gap-1">
        <span className="muted text-xs">حدي الأعلى للمزايدة (ريال)</span>
        <input id={`maxbid-${auctionId}`} className="input num" inputMode="numeric" value={maxBid} onChange={(e) => setMaxBid(e.target.value.replace(/[^\d]/g, ''))} placeholder="مثال: 1500000" />
        {maxBid && <span className="muted num text-xs">{sar(Number(maxBid))} ريال</span>}
      </label>
      <label htmlFor={`note-${auctionId}`} className="flex flex-col gap-1">
        <span className="muted text-xs">ملاحظاتي</span>
        <textarea id={`note-${auctionId}`} className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: زرت الموقع، الشارع غير مسفلت…" />
      </label>
      <div className="flex items-center gap-2">
        <button className="btn bg-brand-600 text-white" onClick={() => save({ note, maxBid: maxBid ? Number(maxBid) : null })}>حفظ</button>
        {msg && <span className="muted text-xs">{msg}</span>}
      </div>
      <div className="border-t border-[var(--border)] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold">قائمة التحقق قبل المزايدة</span>
          <span className="num muted text-xs">{done.length}/{CHECKLIST.length}</span>
        </div>
        <ul className="space-y-1.5">
          {CHECKLIST.map((c) => (
            <li key={c.key}>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1" checked={done.includes(c.key)} onChange={() => tick(c.key)} />
                <span className={done.includes(c.key) ? 'muted line-through' : ''}>{c.label}{c.hint && <span className="muted block text-xs">{c.hint}</span>}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <p className="muted text-xs">حفظ الملاحظات أو التأشير يحفظ المزاد في "المحفوظة" تلقائياً.</p>
    </div>
  );
}
