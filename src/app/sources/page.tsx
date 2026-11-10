'use client';
import { useEffect, useState } from 'react';
import { SOURCE_STATUS, formatRiyadh, timeAgo } from '@/components/format';

const METHOD: Record<string, string> = { api: 'API (JSON)', html: 'صفحات HTML/JSON', browser: 'متصفح (Playwright)' };
const MODE: Record<string, string> = { discovery: 'اكتشاف', live: 'الجارية', closing: 'قرب الإغلاق', upcoming: 'القادمة', ended: 'المنتهية', manual: 'يدوي' };

export default function SourcesPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => fetch('/api/sources').then((r) => r.json()).then(setRows).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, []);

  const refresh = async (id?: string) => {
    const r = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { sourceId: id } : {}) }).then((r) => r.json());
    setMsg(r.error ? `خطأ: ${r.error}` : r.note ?? `تمت جدولة: ${r.queued.join('، ')}`);
    setTimeout(load, 3000);
  };
  const toggle = async (s: any) => { await fetch('/api/sources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, enabled: !s.enabled }) }); load(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">مصادر البيانات</h1><p className="muted text-xs">حالة الاتصال، مدة آخر تحديث، وسجل الأخطاء لكل منصة. فشل أي مصدر لا يمسح بياناته السابقة.</p></div>
        <button className="btn btn-primary" onClick={() => refresh()}>⟳ تحديث الكل الآن</button>
      </div>
      {msg && <div className="card p-3 text-sm">{msg}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows?.map((s) => {
          const st = SOURCE_STATUS[s.status] ?? SOURCE_STATUS.idle;
          return (
            <div key={s.id} className={`card space-y-3 p-4 ${s.enabled ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${st.cls}`} />{s.name} <span className="muted text-xs">({st.label})</span></div>
                  <a href={s.baseUrl} target="_blank" rel="noreferrer" className="muted text-xs" dir="ltr">{s.baseUrl}</a>
                </div>
                <div className="flex gap-1">
                  <button className="btn" onClick={() => refresh(s.id)} disabled={!s.enabled}>تحديث</button>
                  <button className="btn" onClick={() => toggle(s)}>{s.enabled ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="muted">طريقة الجلب</dt><dd>{METHOD[s.method] ?? s.method}</dd></div>
                <div><dt className="muted">المزادات المخزنة</dt><dd className="num">{s._count.listings}</dd></div>
                <div><dt className="muted">آخر نجاح</dt><dd className="num">{s.lastSuccessAt ? `${formatRiyadh(s.lastSuccessAt)} (${timeAgo(s.lastSuccessAt)})` : '—'}</dd></div>
                <div><dt className="muted">مدة آخر عملية</dt><dd className="num">{s.lastDurationMs != null ? `${(s.lastDurationMs / 1000).toFixed(1)} ث` : '—'}</dd></div>
                <div><dt className="muted">آخر عدد سجلات</dt><dd className="num">{s.lastItemCount ?? '—'}</dd></div>
                <div><dt className="muted">إخفاقات متتالية</dt><dd className="num">{s.consecutiveFailures}</dd></div>
              </dl>
              {s.lastError && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200" dir="auto">⚠ {s.lastError}</div>}
              <details className="text-xs">
                <summary className="muted cursor-pointer">آخر العمليات ({s.runs.length})</summary>
                <table className="mt-2 w-full">
                  <thead className="muted"><tr><th className="text-right">الوقت</th><th className="text-right">النوع</th><th className="text-right">النتيجة</th><th className="text-right">المدة</th></tr></thead>
                  <tbody>
                    {s.runs.map((r: any) => (
                      <tr key={r.id} className="border-t border-[var(--border)] align-top">
                        <td className="num py-1">{formatRiyadh(r.startedAt)}</td>
                        <td>{MODE[r.mode] ?? r.mode}{r.attempt > 1 ? ` (محاولة ${r.attempt})` : ''}</td>
                        <td className={r.status === 'ok' ? 'text-emerald-600' : r.status === 'error' ? 'text-red-600' : ''}>
                          {r.status === 'ok' ? `✓ ${r.itemsFound} (جديد ${r.created})` : r.status === 'error' ? <span title={r.error}>✕ {String(r.error).slice(0, 60)}</span> : '…'}
                        </td>
                        <td className="num">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}ث` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
