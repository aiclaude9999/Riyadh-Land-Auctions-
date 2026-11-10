'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { CAT_ICON, STATUS_STYLE, catLabel, fmtMoney, formatRiyadh, statusLabel, timeAgo } from '@/components/format';

const FIELD: Record<string, string> = { startAt: 'موعد البدء', endAt: 'موعد الإغلاق', currentPrice: 'السعر المعروض', status: 'الحالة' };
const GEO_LABEL: Record<string, string> = { riyadh_city: 'مدينة الرياض', riyadh_region: 'منطقة الرياض', other: 'خارج منطقة الرياض', unknown: 'غير محدد' };

export default function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => fetch(`/api/auctions/${id}`).then((r) => r.json()).then((d) => (d.error ? setErr(d.error) : setA(d))).catch((e) => setErr(String(e)));
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [id]); // eslint-disable-line

  if (err) return <div className="card p-6">تعذر تحميل المزاد: {err}</div>;
  if (!a) return <div className="muted p-6">جاري التحميل…</div>;

  const toggle = async () => { await fetch(`/api/saved/${a.id}`, { method: a.saved ? 'DELETE' : 'POST' }); load(); };
  const fmtVal = (f: string, v: string | null) => (v == null ? '—' : f.endsWith('At') ? formatRiyadh(v) : f === 'currentPrice' ? fmtMoney(Number(v)) : f === 'status' ? statusLabel(v) : v);
  const assets = a.listings.flatMap((l: any) => l.assets.map((x: any) => ({ ...x, sourceName: l.source.name })));
  const rows: [string, React.ReactNode][] = [
    ['النوع', `${CAT_ICON[a.category]} ${catLabel(a.category)}`],
    ['الحالة', <span key="s" className={`chip ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>],
    ['البداية', formatRiyadh(a.startAt)],
    ['الإغلاق', formatRiyadh(a.endAt)],
    ['المدينة', a.cities.length ? a.cities.join('، ') : '—'],
    ['الحي', a.district ?? '—'],
    ['العنوان / الموقع', a.locationText ?? '—'],
    ['النطاق', `${GEO_LABEL[a.geoScope]}${a.isMultiLocation ? ' · مزاد متعدد المواقع' : ''}`],
    ['عدد الأصول', a.assetCount ?? '—'],
    ['سعر البداية', fmtMoney(a.startPrice) ?? '—'],
    ['آخر سعر معروض', fmtMoney(a.currentPrice) ?? '—'],
    ['قيمة العربون', fmtMoney(a.deposit) ?? '—'],
    ['الجهة المنظمة', a.organizer ?? '—'],
    ['أول ظهور', formatRiyadh(a.firstSeenAt)],
    ['آخر تحديث ناجح', `${formatRiyadh(a.lastSuccessAt)} (${timeAgo(a.lastSuccessAt)})`],
  ];

  return (
    <div className="space-y-4">
      <Link href="/" className="muted text-sm">→ العودة للمزادات</Link>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card overflow-hidden">
            {a.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.images[0]} alt="" className="max-h-96 w-full object-cover" referrerPolicy="no-referrer" />
            ) : <div className="grid h-48 place-items-center text-6xl opacity-50">{CAT_ICON[a.category]}</div>}
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-bold">{a.title}</h1>
                <button className="btn" onClick={toggle}>{a.saved ? '★ محفوظ' : '☆ حفظ'}</button>
              </div>
              {a.status === 'live' && a.endAt && <div className="text-sm">يغلق خلال: <Countdown to={a.endAt} /></div>}
              {a.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pt-2">
                  {a.images.slice(1).map((src: string) => <img key={src} src={src} alt="" className="h-20 w-28 flex-none rounded-lg object-cover" referrerPolicy="no-referrer" />)}
                </div>
              )}
            </div>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">التفاصيل</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5"><dt className="muted">{k}</dt><dd className="num text-left">{v}</dd></div>)}
            </dl>
            <p className="muted mt-3 text-xs">الحقول الفارغة (—) غير متوفرة في المصدر ولم يتم تخمينها.</p>
          </div>
          {assets.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-3 font-semibold">الأصول ({assets.length})</h2>
              <div className="divide-y divide-[var(--border)] text-sm">
                {assets.map((x: any) => (
                  <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>{x.title ?? x.externalId} <span className="muted text-xs">· {[x.district, x.city].filter(Boolean).join('، ') || 'موقع غير محدد'}{x.geoScope === 'riyadh_city' ? ' · الرياض' : ''}</span></div>
                    <div className="num flex items-center gap-3 text-xs">{fmtMoney(x.currentPrice ?? x.startPrice) ?? ''}{x.url && <a className="text-brand-600" href={x.url} target="_blank" rel="noreferrer">تفاصيل الأصل ↗</a>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">ظهر في المنصات ({a.listings.length})</h2>
            <ul className="space-y-2 text-sm">
              {a.listings.map((l: any) => (
                <li key={l.id} className="rounded-lg border border-[var(--border)] p-2">
                  <a href={l.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-600">{l.source.name} ↗</a>
                  <div className="muted text-xs">المعرّف: <span className="num">{l.externalId}</span> · آخر تحديث {timeAgo(l.lastSuccessAt)}</div>
                  {l.title !== a.title && <div className="muted text-xs">العنوان في المنصة: {l.title}</div>}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">سجل التغييرات</h2>
            {a.changes.length === 0 ? <p className="muted text-sm">لا توجد تغييرات مسجلة.</p> : (
              <ul className="space-y-2 text-xs">
                {a.changes.map((c: any) => (
                  <li key={c.id}><span className="font-semibold">{FIELD[c.field] ?? c.field}</span>: <span className="num">{fmtVal(c.field, c.oldValue)} ← {fmtVal(c.field, c.newValue)}</span><div className="muted">{formatRiyadh(c.at)}</div></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
