'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatRiyadh } from '@/components/format';
import { CATEGORY_LABELS } from '@/lib/normalize';

const RULE_LABELS: Record<string, string> = {
  new_riyadh: 'ظهور مزاد جديد في الرياض', new_category: 'ظهور مزاد جديد من نوع محدد', ending_saved: 'اقتراب انتهاء مزاد محفوظ',
  date_changed: 'تغيير موعد مزاد', price_changed: 'تغيير السعر المعروض',
};
const SCOPES = [{ v: 'riyadh_city', l: 'مدينة الرياض' }, { v: 'riyadh_region', l: 'منطقة الرياض' }, { v: 'all', l: 'كل المملكة' }];

export default function NotificationsPage() {
  const [data, setData] = useState<{ items: any[]; unread: number } | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const load = () => fetch('/api/notifications').then((r) => r.json()).then(setData);
  useEffect(() => { load(); fetch('/api/rules').then((r) => r.json()).then(setRules); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  const markAll = async () => { await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); load(); };
  const update = async (r: any, patch: any) => {
    const next = await fetch('/api/rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ...patch }) }).then((x) => x.json());
    setRules((rs) => rs.map((x) => (x.id === r.id ? next : x)));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">الإشعارات {data?.unread ? <span className="chip bg-red-600 text-white">{data.unread} جديد</span> : null}</h1>
          <button className="btn" onClick={markAll} disabled={!data?.unread}>تعليم الكل كمقروء</button>
        </div>
        {data?.items.length === 0 && <div className="card muted p-6 text-center text-sm">لا توجد إشعارات بعد.</div>}
        {data?.items.map((n) => (
          <div key={n.id} className={`card p-3 ${n.readAt ? 'opacity-70' : 'border-brand-500'}`}>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold">{n.title}</span><span className="num muted text-xs">{formatRiyadh(n.createdAt)}</span></div>
            <div className="text-sm">{n.body}</div>
            {n.auction && <Link href={`/auctions/${n.auction.id}`} className="text-xs text-brand-600">عرض المزاد ←</Link>}
          </div>
        ))}
      </div>
      <div className="card h-fit space-y-3 p-4">
        <h2 className="font-semibold">قواعد الإشعارات</h2>
        <p className="muted text-xs">الإشعارات داخل التطبيق مفعّلة دائماً. Telegram يعمل عند ضبطه في الإعدادات.</p>
        {rules.map((r) => {
          const p = r.params ?? {};
          return (
            <div key={r.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
              <label className="flex items-center justify-between gap-2 font-medium">
                {RULE_LABELS[r.type] ?? r.type}
                <input type="checkbox" checked={r.enabled} onChange={(e) => update(r, { enabled: e.target.checked })} />
              </label>
              {(r.type === 'new_riyadh' || r.type === 'new_category') && (
                <select className="input" value={p.scope ?? 'riyadh_city'} onChange={(e) => update(r, { params: { ...p, scope: e.target.value } })}>
                  {SCOPES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              )}
              {r.type === 'new_riyadh' && (
                <label className="muted flex items-center gap-2 text-xs"><input type="checkbox" checked={!!p.landOnly} onChange={(e) => update(r, { params: { ...p, landOnly: e.target.checked } })} /> مزادات الأراضي فقط</label>
              )}
              {r.type === 'new_category' && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => {
                    const on = (p.categories ?? []).includes(k);
                    return <button key={k} className={`chip ${on ? 'bg-brand-600 text-white' : 'border border-[var(--border)]'}`}
                      onClick={() => update(r, { params: { ...p, categories: on ? p.categories.filter((c: string) => c !== k) : [...(p.categories ?? []), k] } })}>{v}</button>;
                  })}
                </div>
              )}
              {r.type === 'ending_saved' && (
                <label className="muted flex items-center gap-2 text-xs">قبل الإغلاق بـ
                  <input className="input w-20" type="number" min={5} max={1440} value={p.minutes ?? 60} onChange={(e) => update(r, { params: { ...p, minutes: Number(e.target.value) } })} /> دقيقة</label>
              )}
              {(r.type === 'date_changed' || r.type === 'price_changed') && (
                <label className="muted flex items-center gap-2 text-xs"><input type="checkbox" checked={!!p.savedOnly} onChange={(e) => update(r, { params: { ...p, savedOnly: e.target.checked } })} /> للمزادات المحفوظة فقط</label>
              )}
              <label className="muted flex items-center gap-2 text-xs">
                <input type="checkbox" checked={r.channels.includes('telegram')} onChange={(e) => update(r, { channels: e.target.checked ? [...r.channels, 'telegram'] : r.channels.filter((c: string) => c !== 'telegram') })} /> إرسال إلى Telegram أيضاً
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
