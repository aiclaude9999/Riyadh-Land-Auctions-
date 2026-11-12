'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { VERDICT } from '@/components/AssetInsights';
import { fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, timeAgo } from '@/components/format';

type Section = 'results' | 'relisted' | 'platforms';
const TABS: { v: Section; l: string; hint: string }[] = [
  { v: 'results', l: 'نتائج المزادات المنتهية', hint: 'سعر الترسية إذا نشرته المنصة، وإلا آخر سعر ظهر قبل الإغلاق. يُبنى تاريخ أسعارك الخاص مع الوقت.' },
  { v: 'relisted', l: 'أُعيد طرحها', hint: 'نفس رقم الصك ظهر في أكثر من مزاد — غالباً لم يُبع في المرة الأولى، وقد يكون سعره أقل في الطرح الجديد.' },
  { v: 'platforms', l: 'إحصائيات المنصات', hint: 'المزادات النشطة (جاري + قادم) لكل منصة، وعدد أراضي مدينة الرياض ووسيط سعر المتر فيها.' },
];
const n = (v?: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));

/** Market knowledge: results of ended auctions, re-listed properties, platform statistics. */
export default function MarketPage() {
  const [tab, setTab] = useState<Section>('results');
  const [geo, setGeo] = useState('riyadh_city');
  const [type, setType] = useState('land');
  const [loaded, setLoaded] = useState<{ key: string; items: any[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    const key = `${tab}|${geo}|${type}`;
    fetch(`/api/market?section=${tab}&geo=${geo}&type=${type}`).then((r) => r.json()).then((d) => (d.items ? setLoaded({ key, items: d.items }) : setErr(d.error ?? 'خطأ'))).catch((e) => setErr(String(e)));
  }, [tab, geo, type]);
  // only show rows that belong to the current tab/filters (avoids rendering one tab's rows with another tab's layout)
  const data = loaded && loaded.key === `${tab}|${geo}|${type}` ? loaded.items : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">السوق</h1>
        <p className="muted text-sm">{TABS.find((t) => t.v === tab)!.hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="card flex flex-wrap p-1 text-sm">
          {TABS.map((t) => <button key={t.v} onClick={() => setTab(t.v)} className={`rounded-lg px-3 py-1.5 font-medium ${tab === t.v ? 'bg-brand-600 text-white' : 'muted'}`}>{t.l}</button>)}
        </div>
        {tab !== 'platforms' && (
          <>
            <select className="input w-auto" value={geo} onChange={(e) => setGeo(e.target.value)} aria-label="النطاق">
              <option value="riyadh_city">مدينة الرياض</option><option value="riyadh_region">منطقة الرياض</option><option value="all">كل المملكة</option>
            </select>
            {tab === 'results' && (
              <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="النوع">
                <option value="land">الأراضي</option><option value="all">كل العقارات</option>
              </select>
            )}
          </>
        )}
        <span className="muted text-sm">{data ? <><span className="num font-semibold text-[var(--text)]">{data.length}</span> نتيجة</> : err ? `تعذر التحميل: ${err}` : 'جاري التحميل…'}</span>
      </div>

      {data?.length === 0 && (
        <div className="card muted p-8 text-center text-sm">
          {tab === 'results' ? 'لا توجد نتائج بعد. تتراكم مع كل مزاد ينتهي بعد اليوم.' : tab === 'relisted' ? 'لم يظهر نفس الصك في مزادين حتى الآن. أرقام الصكوك تُحفظ من الآن فصاعداً (مباشر وإنفاذ).' : 'لا توجد بيانات.'}
        </div>
      )}

      {tab === 'results' && data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="muted text-xs"><tr className="text-right">
              <th className="p-2 font-medium">العقار</th><th className="font-medium">الحي</th><th className="font-medium">المساحة</th>
              <th className="font-medium">السعر النهائي</th><th className="font-medium">سعر المتر</th><th className="font-medium">مقارنة بالحي</th><th className="font-medium">أغلق</th>
            </tr></thead>
            <tbody>
              {data.map((x) => (
                <tr key={x.id} className="border-t border-[var(--border)] align-top">
                  <td className="p-2"><Link href={`/auctions/${x.listing.auction.id}`} className="hover:text-brand-600">{x.title ?? x.listing.auction.title}</Link><div className="muted text-xs">{propertyLabel(x.propertyType)} · {x.listing.source.name}</div></td>
                  <td className="text-xs">{x.insights?.district ?? x.district ?? '—'}</td>
                  <td className="num whitespace-nowrap">{fmtArea(x.areaSqm) ?? '—'}</td>
                  <td className="num whitespace-nowrap">{fmtMoney(x.finalPrice) ?? '—'}<div className="muted text-xs">{x.priceKind === 'sold' ? 'سعر الترسية' : 'آخر سعر ظاهر'}</div></td>
                  <td className="num whitespace-nowrap">{n(x.ppm)}</td>
                  <td className="text-xs">{x.insights?.verdict ? `${VERDICT[x.insights.verdict as 'below'].dot} ${Math.round(x.insights.diffPct * 100)}%` : '—'}</td>
                  <td className="num whitespace-nowrap text-xs">{formatRiyadh(x.listing.auction.endAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'relisted' && data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.map((g) => (
            <div key={g.deed} className="card space-y-2 p-3 text-sm">
              <div className="font-semibold">{g.list.at(-1).title ?? g.list.at(-1).listing.auction.title}</div>
              <div className="muted num text-xs">صك {g.deed} · {fmtArea(g.list.at(-1).areaSqm) ?? '—'}</div>
              <ol className="space-y-1 text-xs">
                {g.list.map((x: any, i: number) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-1">
                    <span>{i + 1}. <Link href={`/auctions/${x.listing.auction.id}`} className="hover:text-brand-600">{x.listing.auction.title}</Link> · {x.listing.source.name} · {statusLabel(x.listing.auction.status)}</span>
                    <span className="num">{formatRiyadh(x.listing.auction.startAt)} · {fmtMoney(Number(x.soldPrice ?? x.currentPrice ?? x.startPrice) || null) ?? '—'}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {tab === 'platforms' && data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="muted text-xs"><tr className="text-right">
              <th className="p-2 font-medium">المنصة</th><th className="font-medium">مزادات نشطة</th><th className="font-medium">أصول</th>
              <th className="font-medium">أراضي مدينة الرياض</th><th className="font-medium">وسيط سعر المتر (الرياض)</th><th className="font-medium">وسيط العربون</th><th className="font-medium">آخر تحديث</th>
            </tr></thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
                  <td className="p-2 font-semibold">{s.name}</td>
                  <td className="num">{n(s.auctions)}</td>
                  <td className="num">{n(s.assets)}</td>
                  <td className="num">{n(s.riyadhLand)}{s.riyadhLand ? <span className="muted text-xs"> ({n(s.riyadhLandPriced)} بسعر)</span> : null}</td>
                  <td className="num">{s.medianLandPpm ? `${n(s.medianLandPpm)} ريال` : '—'}</td>
                  <td className="num">{s.medianDeposit ? fmtMoney(s.medianDeposit) : '—'}</td>
                  <td className="muted text-xs">{s.lastSuccessAt ? timeAgo(s.lastSuccessAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
