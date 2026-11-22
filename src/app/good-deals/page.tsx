'use client';
import Link from 'next/link';
import { Cover } from '@/components/Cover';
import { GridSkeleton } from '@/components/Skeleton';
import { useEffect, useState } from 'react';
import AssetInsights, { PriceMark, AssetNotes } from '@/components/AssetInsights';
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
        <h1 className="text-2xl font-bold">فرص أقل من السوق</h1>
        <p className="muted text-sm">أراضي مدينة الرياض في المزادات، مقارنة بوسيط سعر متر الأراضي في نفس الحي (صفقات وزارة العدل). الأقل سعراً أولاً.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg flex-wrap">
          <button onClick={() => setVerdict('below')} aria-pressed={verdict === 'below'}>أقل من السوق فقط</button>
          <button onClick={() => setVerdict('all')} aria-pressed={verdict === 'all'}>كل الأراضي المسعّرة</button>
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
          <option value="">النشطة (جاري + قادم)</option><option value="live">جاري</option><option value="upcoming">قادم</option><option value="all">الكل</option>
        </select>
        <span className="muted text-sm">{data ? <><span className="num font-semibold text-[var(--text)]">{data.total}</span> قطعة</> : err ? `تعذر التحميل: ${err}` : ''}</span>
      </div>

      {data?.items.length === 0 && (
        <div className="card muted p-8 text-center text-sm">
          لا توجد قطع مطابقة الآن. تظهر هنا فقط الأراضي التي لها سعر افتتاح ومساحة وموقع داخل حي له صفقات كافية (3 فأكثر).
          {verdict === 'below' && <div className="mt-3"><button className="btn press" onClick={() => setVerdict('all')}>عرض كل الأراضي المسعّرة</button></div>}
        </div>
      )}

      {!data && !err && <GridSkeleton n={4} cover="aspect-[3/1]" className="grid grid-cols-1 gap-3 md:grid-cols-2" />}
      <div key={`${verdict}|${status}`} className="rise-list grid grid-cols-1 gap-3 md:grid-cols-2">
        {data?.items.map((x: any) => {
          const a = x.listing.auction;
          return (
            <article key={x.id} className="card lift flex flex-col overflow-hidden text-sm">
              <Link href={`/auctions/${a.id}`} tabIndex={-1} aria-hidden="true">
                <Cover src={x.images?.[0]} ratio="aspect-[3/1]" figure={fmtArea(x.areaSqm)} caption={x.insights?.district ? `حي ${x.insights.district}` : null}>
                  {x.insights?.verdict && <PriceMark verdict={x.insights.verdict} diff={x.insights.diffPct} />}
                </Cover>
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/auctions/${a.id}`} className="text-[15px] font-bold leading-snug hover:text-[var(--accent)]">{x.title ?? a.title}</Link>
                <span className={`chip flex-none ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
              </div>
              <div className="muted text-xs">حي {x.insights?.district ?? x.district ?? '—'} · {x.listing.source.name}</div>
              <div className="num grid grid-cols-3 gap-2 rounded-lg bg-[var(--sunk)] px-3 py-2 text-xs">
                <div><div className="label">المساحة</div><div className="text-[15px] font-bold">{fmtArea(x.areaSqm) ?? '—'}</div></div>
                <div><div className="label">{x.currentPrice ? 'آخر سعر' : 'الافتتاح'}</div><div className="text-[15px] font-bold">{fmtMoney(x.currentPrice ?? x.startPrice) ?? '—'}</div></div>
                <div><div className="label">العربون</div><div className="text-[15px] font-bold">{fmtMoney(x.deposit) ?? '—'}</div></div>
              </div>
              <AssetInsights ins={x.insights} area={x.areaSqm} price={x.currentPrice ?? x.startPrice} deposit={x.deposit} asset={x} />
              <AssetNotes description={x.description} notes={x.notes} />
              <div className="muted flex items-center justify-between text-xs">
                <a href={x.listing.url} target="_blank" rel="noreferrer" className="link">صفحة المزاد ↗</a>
                {a.status === 'live' && a.endAt ? <Countdown to={a.endAt} compact /> : <span className="num">{formatRiyadh(a.status === 'upcoming' ? a.startAt : a.endAt)}</span>}
              </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="muted text-xs">
        كيف يُحسب: سعر متر القطعة = سعر الافتتاح (أو آخر سعر) ÷ المساحة، ويُقارن بوسيط سعر متر الأراضي في الحي من ملفات وزارة العدل
        (تقدير: صفقة سكنية لعقار واحد أكبر من 200 م²). أقل بـ 15% فأكثر = أخضر، ضمن ±15% = أصفر، أعلى بـ 15% فأكثر = أحمر.
        الموقع داخل الحي، الشارع، الواجهات والملاحظات تغيّر القيمة الحقيقية — تحقق دائماً قبل المزايدة.
      </p>
    </div>
  );
}
