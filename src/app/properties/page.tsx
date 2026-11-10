'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Countdown } from '@/components/Countdown';
import { STATUS_STYLE, fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, usageLabel } from '@/components/format';
import { PROPERTY_LABELS, USAGE_LABELS } from '@/lib/normalize';

const TYPE_ICON: Record<string, string> = { land: '🟫', villa: '🏡', apartment: '🏢', building: '🏬', rest_house: '🏕️', farm: '🌴', commercial: '🏪', other: '🏠', unknown: '🏠' };
const GEO = [{ v: 'riyadh_city', l: 'مدينة الرياض' }, { v: 'riyadh_region', l: 'منطقة الرياض' }, { v: 'all', l: 'كل المملكة' }];
const SORTS = [{ v: 'ending', l: 'الأقرب انتهاءً' }, { v: 'newest', l: 'الأحدث' }, { v: 'price_asc', l: 'الأقل سعراً' }, { v: 'price_desc', l: 'الأعلى سعراً' }, { v: 'area_desc', l: 'الأكبر مساحة' }, { v: 'area_asc', l: 'الأصغر مساحة' }];
const EMPTY = { q: '', usage: '', status: '', district: '', minArea: '', maxArea: '', minPrice: '', maxPrice: '' };

export default function PropertiesPage() {
  const [geo, setGeo] = useState('riyadh_city');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('ending');
  const [f, setF] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const qs = useMemo(() => {
    const p = new URLSearchParams({ geo, sort, page: String(page), pageSize: '30' });
    if (type) p.set('propertyType', type);
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    return p.toString();
  }, [geo, type, sort, f, page]);

  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/assets?${qs}`).then((r) => r.json()).then((d) => alive && setData(d));
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [qs]);
  // type counts for the chips (same filters, all types)
  useEffect(() => {
    const p = new URLSearchParams(qs); p.delete('propertyType'); p.set('pageSize', '1');
    fetch(`/api/assets?${p}`).then((r) => r.json()).then((d) => setCounts(d.byType ?? {}));
  }, [qs]);

  const set = (k: keyof typeof EMPTY, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">الأصول العقارية</h1>
          <p className="muted text-xs">كل عقار معروض في المزادات (أرض، فيلا، عمارة…) بشكل مستقل، حسب موقع العقار نفسه</p>
        </div>
        <div className="card flex p-1 text-sm">
          {GEO.map((g) => <button key={g.v} onClick={() => { setGeo(g.v); setPage(1); }} className={`rounded-lg px-3 py-1.5 font-medium ${geo === g.v ? 'bg-brand-600 text-white' : 'muted'}`}>{g.l}</button>)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setType(''); setPage(1); }} className={`chip px-3 py-1.5 text-sm ${type === '' ? 'bg-amber-700 text-white' : 'card'}`}>الكل <span className="num opacity-75">{total}</span></button>
        {Object.entries(PROPERTY_LABELS).map(([k, v]) => counts[k] ? (
          <button key={k} onClick={() => { setType(k); setPage(1); }} className={`chip px-3 py-1.5 text-sm ${type === k ? 'bg-amber-700 text-white' : 'card'}`}>{TYPE_ICON[k]} {v} <span className="num opacity-75">{counts[k]}</span></button>
        ) : null)}
      </div>

      <div className="card grid grid-cols-2 gap-2 p-3 md:grid-cols-4 lg:grid-cols-8">
        <input className="input col-span-2" placeholder="بحث بالاسم أو الحي أو الجهة…" value={f.q} onChange={(e) => set('q', e.target.value)} />
        <input className="input" placeholder="الحي" value={f.district} onChange={(e) => set('district', e.target.value)} />
        <select className="input" value={f.usage} onChange={(e) => set('usage', e.target.value)}>
          <option value="">كل الاستخدامات</option>{Object.entries(USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">النشطة</option><option value="live">جاري</option><option value="upcoming">قادم</option><option value="ended">منتهي</option>
        </select>
        <select className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <div className="col-span-2 flex gap-1"><input className="input" inputMode="numeric" placeholder="المساحة من م²" value={f.minArea} onChange={(e) => set('minArea', e.target.value.replace(/\D/g, ''))} /><input className="input" inputMode="numeric" placeholder="إلى" value={f.maxArea} onChange={(e) => set('maxArea', e.target.value.replace(/\D/g, ''))} /></div>
        <div className="col-span-2 flex gap-1"><input className="input" inputMode="numeric" placeholder="السعر من ر.س" value={f.minPrice} onChange={(e) => set('minPrice', e.target.value.replace(/\D/g, ''))} /><input className="input" inputMode="numeric" placeholder="إلى" value={f.maxPrice} onChange={(e) => set('maxPrice', e.target.value.replace(/\D/g, ''))} /></div>
        {Object.values(f).some(Boolean) && <button className="btn" onClick={() => { setF(EMPTY); setPage(1); }}>مسح الفلاتر</button>}
      </div>

      <div className="muted text-sm">{data ? <><span className="num font-semibold text-[var(--text)]">{data.total}</span> عقار</> : 'جاري التحميل…'}</div>

      {data?.items.length === 0 && <div className="card muted p-10 text-center">لا توجد عقارات مطابقة — جرّب توسيع النطاق أو تغيير الفلاتر.</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((x: any) => {
          const a = x.listing.auction;
          const img = x.images?.[0];
          return (
            <div key={x.id} className="card flex gap-3 overflow-hidden p-0">
              <Link href={`/auctions/${a.id}`} className="relative w-28 flex-none bg-amber-50 dark:bg-amber-950/30">
                {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  : <div className="grid h-full place-items-center text-4xl">{TYPE_ICON[x.propertyType ?? 'unknown']}</div>}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-2 pl-3 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="chip bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{TYPE_ICON[x.propertyType ?? 'unknown']} {propertyLabel(x.propertyType) === '—' ? 'غير محدد' : propertyLabel(x.propertyType)}</span>
                  {x.usage && <span className="chip border border-[var(--border)]">{usageLabel(x.usage)}</span>}
                  <span className={`chip ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
                </div>
                <Link href={`/auctions/${a.id}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-brand-600">{x.title ?? a.title}</Link>
                <div className="muted truncate">📍 {[x.district && `حي ${x.district.replace(/^حي\s+/, '')}`, x.city ?? x.region].filter(Boolean).join('، ') || (x.latitude != null ? 'على الخريطة' : 'الموقع غير متوفر')}{x.latitude != null && <> · <a className="text-brand-600" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`}>خريطة</a></>}</div>
                <div className="num grid grid-cols-3 gap-1 border-t border-[var(--border)] pt-1">
                  <div><div className="muted">المساحة</div><div className="font-semibold">{fmtArea(x.areaSqm) ?? '—'}</div></div>
                  <div><div className="muted">{x.currentPrice ? 'آخر سعر' : 'الافتتاح'}</div><div className="font-semibold">{fmtMoney(x.currentPrice ?? x.startPrice) ?? '—'}</div></div>
                  <div><div className="muted">العربون</div><div className="font-semibold">{fmtMoney(x.deposit) ?? '—'}</div></div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="muted truncate">🔨 {a.title} · <a href={x.listing.url} target="_blank" rel="noreferrer" className="text-brand-600">{x.listing.source.name} ↗</a></span>
                  <span className="flex-none">{a.status === 'live' && a.endAt ? <Countdown to={a.endAt} compact /> : <span className="num muted">{formatRiyadh(a.status === 'upcoming' ? a.startAt : a.endAt)}</span>}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</button>
          <span className="num muted text-sm">{page} / {pages}</span>
          <button className="btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>التالي</button>
        </div>
      )}
    </div>
  );
}
