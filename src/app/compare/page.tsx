'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { VERDICT } from '@/components/AssetInsights';
import { useCompare } from '@/components/compare';
import { fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, usageLabel } from '@/components/format';
import { featuresLabel } from '@/lib/plot';

const n = (v?: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));

/** Side-by-side comparison of up to 4 assets picked on the Properties page. */
function Compare() {
  const sp = useSearchParams();
  const cmp = useCompare();
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean);
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    fetch(`/api/assets?ids=${ids.join(',')}`).then((r) => r.json()).then((d) => (d.items ? setItems(ids.map((id) => d.items.find((x: any) => x.id === id)).filter(Boolean)) : setErr(d.error ?? 'خطأ'))).catch((e) => setErr(String(e)));
  }, [sp]); // eslint-disable-line

  const rows: [string, (x: any) => React.ReactNode][] = [
    ['النوع', (x) => `${propertyLabel(x.propertyType)}${x.usage ? ' · ' + usageLabel(x.usage) : ''}`],
    ['الحي', (x) => x.insights?.district ?? x.district ?? '—'],
    ['المساحة', (x) => fmtArea(x.areaSqm) ?? '—'],
    ['السعر', (x) => fmtMoney(x.currentPrice ?? x.startPrice) ?? '—'],
    ['سعر المتر', (x) => (x.insights?.plotPpm != null ? `${n(x.insights.plotPpm)} ريال` : '—')],
    ['سعر متر الحي', (x) => (x.insights?.benchPpm != null ? `${n(x.insights.benchPpm)} ريال` : '—')],
    ['المقارنة بالحي', (x) => (x.insights?.verdict ? `${VERDICT[x.insights.verdict as 'below'].dot} ${VERDICT[x.insights.verdict as 'below'].label} (${Math.round(x.insights.diffPct * 100)}%)` : '—')],
    ['حد أعلى مقترح', (x) => (x.insights?.maxBid != null ? `${n(x.insights.maxBid)} ريال` : '—')],
    ['العربون', (x) => fmtMoney(x.deposit) ?? '—'],
    ['الشوارع', (x) => featuresLabel(x) ?? '—'],
    ['أقرب محطة مترو', (x) => (x.insights?.metro ? `${x.insights.metro.km} كم — ${x.insights.metro.name}` : '—')],
    ['قريب من', (x) => (x.insights?.projects ? x.insights.projects.map((p: any) => `${p.name} (${p.km} كم)`).join('، ') : '—')],
    ['رسوم أراضٍ بيضاء', (x) => (x.insights?.whiteLand ? '⚠️ محتملة' : '—')],
    ['الحالة', (x) => statusLabel(x.listing.auction.status)],
    ['الإغلاق', (x) => formatRiyadh(x.listing.auction.endAt)],
    ['المنصة', (x) => <a href={x.listing.url} target="_blank" rel="noreferrer" className="text-brand-600">{x.listing.source.name} ↗</a>],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">مقارنة العقارات</h1>
          <p className="muted text-sm">اختر حتى 4 عقارات من صفحة العقارات (مربع "قارن") ثم افتح هذه الصفحة.</p>
        </div>
        {cmp.ids.length > 0 && <button className="btn" onClick={cmp.clear}>مسح الاختيار</button>}
      </div>
      {err && <div className="card p-4">تعذر التحميل: {err}</div>}
      {items && items.length === 0 && <div className="card muted p-8 text-center">لم تختر عقارات بعد. <Link href="/properties" className="text-brand-600">اذهب إلى العقارات</Link></div>}
      {items && items.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-right align-top">
                <th className="w-32 p-3"></th>
                {items.map((x) => <th key={x.id} className="p-3 font-semibold"><Link href={`/auctions/${x.listing.auction.id}`} className="hover:text-brand-600">{x.title ?? x.listing.auction.title}</Link></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f]) => (
                <tr key={label} className="border-b border-[var(--border)] align-top">
                  <td className="muted p-3 text-xs">{label}</td>
                  {items.map((x) => <td key={x.id} className="num p-3">{f(x)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return <Suspense fallback={<div className="muted p-6">…</div>}><Compare /></Suspense>;
}
