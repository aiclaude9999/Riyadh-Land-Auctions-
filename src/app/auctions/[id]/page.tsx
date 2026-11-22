'use client';
import AssetInsights, { AssetNotes } from '@/components/AssetInsights';
import MyPlan from '@/components/MyPlan';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Cover } from '@/components/Cover';
import { Icon } from '@/components/Icon';
import { PageSkeleton } from '@/components/Skeleton';
import { PriceMark } from '@/components/AssetInsights';
import { STATUS_STYLE, catLabel, fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, timeAgo, usageLabel } from '@/components/format';

const FIELD: Record<string, string> = { startAt: 'موعد البدء', endAt: 'موعد الإغلاق', currentPrice: 'السعر المعروض', status: 'الحالة' };
const GEO_LABEL: Record<string, string> = { riyadh_city: 'مدينة الرياض', riyadh_region: 'منطقة الرياض', other: 'خارج منطقة الرياض', unknown: 'غير محدد' };

export default function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => fetch(`/api/auctions/${id}`).then((r) => r.json()).then((d) => (d.error ? setErr(d.error) : setA(d))).catch((e) => setErr(String(e)));
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [id]); // eslint-disable-line

  if (err) return <div className="card p-6">تعذر تحميل المزاد: {err}</div>;
  if (!a) return <PageSkeleton />;

  const toggle = async () => { await fetch(`/api/saved/${a.id}`, { method: a.saved ? 'DELETE' : 'POST' }); load(); };
  const fmtVal = (f: string, v: string | null) => (v == null ? '—' : f.endsWith('At') ? formatRiyadh(v) : f === 'currentPrice' ? fmtMoney(Number(v)) : f === 'status' ? statusLabel(v) : v);
  const assets = a.listings.flatMap((l: any) => l.assets.map((x: any) => ({ ...x, sourceName: l.source.name })));
  const rows: [string, React.ReactNode][] = [
    ['النوع', catLabel(a.category)],
    ['الحالة', <span key="s" className={`chip ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>],
    ['البداية', formatRiyadh(a.startAt)],
    ['الإغلاق', formatRiyadh(a.endAt)],
    ['المدينة', a.cities.length ? a.cities.join('، ') : '—'],
    ['الحي', a.district ?? '—'],
    ['العنوان / الموقع', a.locationText ?? '—'],
    ['النطاق', `${GEO_LABEL[a.geoScope]}${a.isMultiLocation ? ' · مزاد متعدد المواقع' : ''}`],
    ['عدد الأصول', a.assetCount ?? '—'],
    ['قطع الأراضي', a.landCount != null ? a.landCount : a.hasLand ? 'غير محدد' : '—'],
    ['إجمالي مساحة الأراضي', fmtArea(a.landAreaSqm) ?? '—'],
    ['أنواع العقارات', a.propertyTypes.length ? a.propertyTypes.map(propertyLabel).join('، ') : '—'],
    ['الاستخدام', a.usages.length ? a.usages.map(usageLabel).join('، ') : '—'],
    [a.assetCount > 1 ? 'سعر الافتتاح (أقل أصل)' : 'سعر البداية', fmtMoney(a.startPrice) ?? '—'],
    ['آخر سعر معروض', fmtMoney(a.currentPrice) ?? '—'],
    [a.assetCount > 1 ? 'العربون (أقل أصل)' : 'قيمة العربون', fmtMoney(a.deposit) ?? '—'],
    ['الجهة المنظمة', a.organizer ?? '—'],
    ['أول ظهور', formatRiyadh(a.firstSeenAt)],
    ['آخر تحديث ناجح', `${formatRiyadh(a.lastSuccessAt)} (${timeAgo(a.lastSuccessAt)})`],
  ];

  const place = [a.district, a.cities.length ? a.cities.join('، ') : a.city].filter(Boolean).join('، ') || a.locationText;
  const lands = assets.filter((x: any) => x.propertyType === 'land');
  const sorted = [...assets].sort((x: any, y: any) => (x.propertyType === 'land' ? 0 : 1) - (y.propertyType === 'land' ? 0 : 1));
  const fact = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="rounded-lg bg-[var(--sunk)] px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="num text-lg font-bold leading-snug">{value}</div>
      {sub && <div className="muted text-[11px]">{sub}</div>}
    </div>
  );
  const sources = a.listings as any[];

  return (
    <div className="space-y-5">
      <Link href="/" className="muted inline-flex items-center gap-1 text-sm hover:text-[var(--text)]">→ العودة للمزادات</Link>

      {/* hero: the picture large, the facts that decide a bid beside it */}
      <section className="rise grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <div className="card overflow-hidden">
            <Cover src={a.images[0]} ratio="aspect-[16/10]" figure={a.landAreaSqm ? fmtArea(a.landAreaSqm) : null}
              caption={a.hasLand ? `${a.landCount ?? ''} ${a.landCount === 1 ? 'قطعة أرض' : 'قطع أراضٍ'}`.trim() : catLabel(a.category)} />
          </div>
          {a.images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {a.images.slice(1, 9).map((src: string) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="flex-none overflow-hidden rounded-lg border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-24 object-cover" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')} />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="card flex min-w-0 flex-col gap-4 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
            <span className="chip chip-quiet">{GEO_LABEL[a.geoScope]}</span>
            {a.usages.map((u: string) => <span key={u} className="chip chip-quiet">{usageLabel(u)}</span>)}
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{a.title}</h1>
            <p className="muted mt-1 flex items-center gap-1 text-sm"><Icon name="pin" size={15} />{place ?? 'الموقع غير متوفر'}{a.organizer ? ` · ${a.organizer}` : ''}</p>
          </div>
          {a.status === 'live' && a.endAt ? (
            <div className="rounded-lg bg-[var(--accent-soft)] px-3 py-2.5">
              <div className="label">يغلق خلال</div>
              <div className="text-xl font-bold text-[var(--accent)]"><Countdown to={a.endAt} /></div>
              <div className="muted num text-[11px]">{formatRiyadh(a.endAt)}</div>
            </div>
          ) : (
            <div className="rounded-lg bg-[var(--sunk)] px-3 py-2.5">
              <div className="label">{a.status === 'upcoming' ? 'يبدأ' : 'انتهى'}</div>
              <div className="num text-lg font-bold">{formatRiyadh(a.status === 'upcoming' ? a.startAt : a.endAt)}</div>
              {a.status === 'upcoming' && <div className="muted num text-[11px]">يغلق {formatRiyadh(a.endAt)}</div>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {fact(a.hasLand ? 'مساحة الأراضي' : 'عدد الأصول', a.hasLand ? fmtArea(a.landAreaSqm) ?? '—' : a.assetCount ?? '—', a.hasLand && a.landCount ? `${a.landCount} قطعة · ${a.assetCount ?? assets.length} أصل` : undefined)}
            {fact(a.currentPrice ? 'آخر سعر' : a.assetCount > 1 ? 'يبدأ من' : 'سعر البداية', fmtMoney(a.currentPrice ?? a.startPrice) ?? '—')}
            {fact(a.assetCount > 1 ? 'العربون (من)' : 'العربون', fmtMoney(a.deposit) ?? '—')}
            {fact('المنصات', sources.length, sources.map((l) => l.source.name).join('، '))}
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <button className={`btn press ${a.saved ? '' : 'btn-primary'}`} onClick={toggle} aria-pressed={!!a.saved}>
              <Icon name="star" size={16} fill={!!a.saved} />{a.saved ? 'محفوظ' : 'حفظ المزاد'}
            </button>
            {sources.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="btn press">{l.source.name}<Icon name="external" size={14} /></a>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {assets.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold">الأصول <span className="muted num text-base font-semibold">{assets.length}{lands.length ? ` · ${lands.length} أرض` : ''}</span></h2>
              <div className="rise-list space-y-3">
                {sorted.map((x: any) => (
                  <article key={x.id} className="card overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      <div className="sm:w-56 sm:flex-none">
                        <Cover src={x.images?.[0]} ratio="aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[150px]" figure={fmtArea(x.areaSqm)}
                          caption={[propertyLabel(x.propertyType) === '—' ? null : propertyLabel(x.propertyType), x.usage && usageLabel(x.usage)].filter(Boolean).join(' · ') || null}>
                          {x.insights?.verdict && <PriceMark verdict={x.insights.verdict} diff={x.insights.diffPct} />}
                        </Cover>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2 p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-bold leading-snug">{x.title ?? x.externalId}</h3>
                          {x.url && <a className="link flex-none" href={x.url} target="_blank" rel="noreferrer" aria-label="فتح الأصل في المنصة"><Icon name="external" size={16} /></a>}
                        </div>
                        <div className="muted flex flex-wrap items-center gap-x-2">
                          <span>{[x.district && `حي ${String(x.district).replace(/^حي\s+/, '')}`, x.city ?? x.region].filter(Boolean).join('، ') || '—'}</span>
                          {x.latitude != null && <a className="link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`}>خريطة ↗</a>}
                          <span>· {x.sourceName}</span>
                        </div>
                        <div className="num grid grid-cols-3 gap-2 rounded-lg bg-[var(--sunk)] px-3 py-2">
                          <div><div className="label">المساحة</div><div className="text-[15px] font-bold">{fmtArea(x.areaSqm) ?? '—'}</div></div>
                          <div><div className="label">{x.currentPrice ? 'آخر سعر' : 'الافتتاح'}</div><div className="text-[15px] font-bold">{fmtMoney(x.currentPrice ?? x.startPrice) ?? '—'}</div></div>
                          <div><div className="label">العربون</div><div className="text-[15px] font-bold">{fmtMoney(x.deposit) ?? '—'}</div></div>
                        </div>
                        <AssetNotes description={x.description} notes={x.notes} clamp={false} />
                        <AssetInsights ins={x.insights} area={x.areaSqm} price={x.currentPrice ?? x.startPrice} deposit={x.deposit} asset={x} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <details className="card group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
              كل التفاصيل
              <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </summary>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] py-2"><dt className="muted">{k}</dt><dd className="num text-left">{v}</dd></div>)}
            </dl>
            <p className="muted mt-3 text-xs">الحقول الفارغة (—) غير متوفرة في المصدر ولم يتم تخمينها.</p>
          </details>
        </div>
        <aside className="min-w-0 space-y-4">
          <MyPlan auctionId={a.id} saved={a.saved} onSaved={load} />
          <div className="card p-4">
            <h2 className="mb-3 font-bold">ظهر في المنصات ({a.listings.length})</h2>
            <ul className="space-y-2 text-sm">
              {a.listings.map((l: any) => (
                <li key={l.id} className="rounded-lg bg-[var(--sunk)] p-2.5">
                  <a href={l.url} target="_blank" rel="noreferrer" className="link">{l.source.name} ↗</a>
                  <div className="muted text-xs">المعرّف: <span className="num">{l.externalId}</span> · آخر تحديث {timeAgo(l.lastSuccessAt)}</div>
                  {l.title !== a.title && <div className="muted text-xs">العنوان في المنصة: {l.title}</div>}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-bold">سجل التغييرات</h2>
            {a.changes.length === 0 ? <p className="muted text-sm">لا توجد تغييرات مسجلة.</p> : (
              <ul className="space-y-2 text-xs">
                {a.changes.map((c: any) => (
                  <li key={c.id}><span className="font-semibold">{FIELD[c.field] ?? c.field}</span>: <span className="num">{fmtVal(c.field, c.oldValue)} ← {fmtVal(c.field, c.newValue)}</span><div className="muted">{formatRiyadh(c.at)}</div></li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
