'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AssetInsights, { AssetNotes } from '@/components/AssetInsights';
import { Countdown } from '@/components/Countdown';
import { STATUS_STYLE, fmtArea, fmtMoney, formatRiyadh, statusLabel } from '@/components/format';

/** Riyadh land plots whose price per m² is below (or near/above) their district's median land price. */
export default function GoodDealsPage() {
  const [verdict, setVerdict] = useState<'below' | 'all'>('below');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<{ total: number; items: any[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null); setErr(null);
    const qs = new URLSearchParams({ verdict, ...(status ? { status } : {}) });
    fetch(`/api/good-deals?${qs}`).then((r) => r.json()).then((d) => (d.items ? setData(d) : setErr(d.error ?? 'خطأ'))).catch((e) => setErr(String(e)));
  }, [verdict, status]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">فرص أقل من السوق</h1>
        <p className="muted text-sm">أراضي مدينة الرياض في المزادات، مقارنة بوسيط سعر متر الأراضي في نفس الحي (صفقات وزارة العدل). الأقل سعراً أولاً.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="card flex p-1 text-sm">
          <button onClick={() => setVerdict('below')} className={`rounded-lg px-3 py-1.5 font-medium ${verdict === 'below' ? 'bg-brand-600 text-white' : 'muted'}`}>🟢 أقل من السوق فقط</button>
          <button onClick={() => setVerdict('all')} className={`rounded-lg px-3 py-1.5 font-medium ${verdict === 'all' ? 'bg-brand-600 text-white' : 'muted'}`}>كل الأراضي المسعّرة</button>
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
          <option value="">النشطة (جاري + قادم)</option><option value="live">جاري</option><option value="upcoming">قادم</option><option value="all">الكل</option>
        </select>
        <span className="muted text-sm">{data ? <><span className="num font-semibold text-[var(--text)]">{data.total}</span> قطعة</> : err ? `تعذر التحميل: ${err}` : 'جاري التحميل…'}</span>
      </div>

      {data?.items.length === 0 && (
        <div className="card muted p-8 text-center text-sm">
          لا توجد قطع مطابقة الآن. تظهر هنا فقط الأراضي التي لها سعر افتتاح ومساحة وموقع داخل حي له صفقات كافية (3 فأكثر).
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data?.items.map((x: any) => {
          const a = x.listing.auction;
          return (
            <div key={x.id} className="card flex flex-col gap-2 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/auctions/${a.id}`} className="font-semibold leading-snug hover:text-brand-600">{x.title ?? a.title}</Link>
                <span className={`chip flex-none ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
              </div>
              <div className="muted text-xs">📍 حي {x.insights?.district ?? x.district ?? '—'} · {x.listing.source.name}</div>
              <div className="num grid grid-cols-3 gap-1 border-y border-[var(--border)] py-1 text-xs">
                <div><div className="muted">المساحة</div><b>{fmtArea(x.areaSqm) ?? '—'}</b></div>
                <div><div className="muted">{x.currentPrice ? 'آخر سعر' : 'الافتتاح'}</div><b>{fmtMoney(x.currentPrice ?? x.startPrice) ?? '—'}</b></div>
                <div><div className="muted">العربون</div><b>{fmtMoney(x.deposit) ?? '—'}</b></div>
              </div>
              <AssetInsights ins={x.insights} area={x.areaSqm} price={x.currentPrice ?? x.startPrice} deposit={x.deposit} />
              <AssetNotes description={x.description} notes={x.notes} />
              <div className="muted flex items-center justify-between text-xs">
                <a href={x.listing.url} target="_blank" rel="noreferrer" className="text-brand-600">صفحة المزاد ↗</a>
                {a.status === 'live' && a.endAt ? <Countdown to={a.endAt} compact /> : <span className="num">{formatRiyadh(a.status === 'upcoming' ? a.startAt : a.endAt)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted text-xs">
        كيف يُحسب: سعر متر القطعة = سعر الافتتاح (أو آخر سعر) ÷ المساحة، ويُقارن بوسيط سعر متر الأراضي في الحي من ملفات وزارة العدل
        (تقدير: صفقة سكنية لعقار واحد أكبر من 200 م²). أقل بـ 15% فأكثر = 🟢، ضمن ±15% = 🟡، أعلى بـ 15% فأكثر = 🔴.
        الموقع داخل الحي، الشارع، الواجهات والملاحظات تغيّر القيمة الحقيقية — تحقق دائماً قبل المزايدة.
      </p>
    </div>
  );
}
