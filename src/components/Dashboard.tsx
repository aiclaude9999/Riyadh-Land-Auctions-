'use client';
import { GridSkeleton } from './Skeleton';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuctionCard, type AuctionItem } from './AuctionCard';
import { SOURCE_STATUS, catLabel, formatRiyadh, timeAgo } from './format';
import { CATEGORY_LABELS, PROPERTY_LABELS, USAGE_LABELS } from '@/lib/normalize';

type Geo = 'riyadh_city' | 'riyadh_region' | 'all';
type Focus = 'land' | 'real_estate' | 'all';
const FOCUS: { v: Focus; label: string }[] = [
  { v: 'land', label: 'الأراضي' },
  { v: 'real_estate', label: 'كل العقارات' },
  { v: 'all', label: 'كل الأنواع' },
];
const GEO: { v: Geo; label: string }[] = [
  { v: 'riyadh_city', label: 'مدينة الرياض' },
  { v: 'riyadh_region', label: 'منطقة الرياض' },
  { v: 'all', label: 'كل المملكة' },
];
const SORTS = [
  { v: 'newest', label: 'الأحدث إضافة' },
  { v: 'ending', label: 'الأقرب انتهاءً' },
  { v: 'starting', label: 'الأقرب بدءاً' },
  { v: 'price_desc', label: 'الأعلى سعراً' },
  { v: 'price_asc', label: 'الأقل سعراً' },
  { v: 'area_desc', label: 'الأكبر مساحة' },
  { v: 'area_asc', label: 'الأصغر مساحة' },
];
const EMPTY_FILTERS = { q: '', category: '', source: '', status: '', city: '', district: '', organizer: '', startFrom: '', startTo: '', endFrom: '', endTo: '', minPrice: '', maxPrice: '', usage: '', propertyType: '', minArea: '', maxArea: '' };
type Filters = typeof EMPTY_FILTERS;

interface Stats {
  total: number; live: number; upcoming: number; endingToday: number; new24h: number; lastUpdate: string | null;
  sources: { id: string; name: string; status: string; lastSuccessAt: string | null; lastError: string | null; enabled: boolean }[];
}

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export function Dashboard({ savedOnly = false }: { savedOnly?: boolean }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [focus, setFocus] = useState<Focus>('land');
  const [sort, setSort] = useState('newest');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [quick, setQuick] = useState<'' | 'endingToday' | 'new24h' | 'live' | 'upcoming'>('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState<{ total: number; items: AuctionItem[] } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [facets, setFacets] = useState<{ cities: string[]; organizers: string[]; districts: string[]; sources: { id: string; name: string }[] } | null>(null);
  const [uiRefresh, setUiRefresh] = useState(60);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pageSize = 24;

  // initial: geo from localStorage, else settings default
  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      setUiRefresh(s?.intervals?.uiRefreshSec ?? 60);
      setFocus(load<Focus | null>('focus', null) ?? s?.defaultFocus ?? 'land');
      setGeo(load<Geo | null>('geo', null) ?? s?.defaultGeo ?? 'riyadh_city');
    }).catch(() => setGeo(load<Geo>('geo', 'riyadh_city')));
    setSort(load('sort', 'newest'));
  }, []);

  const qs = useMemo(() => {
    if (!geo) return null;
    const p = new URLSearchParams({ geo, focus, sort, page: String(page), pageSize: String(pageSize) });
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    if (savedOnly) p.set('saved', '1');
    if (quick === 'endingToday') p.set('endingToday', '1');
    if (quick === 'new24h') p.set('newSince', new Date(Date.now() - 86_400_000).toISOString());
    if (quick === 'new24h' || quick === 'endingToday') p.delete('status');
    if (quick === 'live' || quick === 'upcoming') p.set('status', quick);
    return p.toString();
  }, [geo, focus, sort, filters, page, savedOnly, quick]);

  const reqId = useRef(0);
  const refresh = useCallback(async (silent = false) => {
    if (!qs || !geo) return;
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    try {
      const [a, s] = await Promise.all([fetch(`/api/auctions?${qs}`).then((r) => r.json()), fetch(`/api/stats?geo=${geo}&focus=${focus}`).then((r) => r.json())]);
      if (id !== reqId.current) return;
      if (a.error) throw new Error(a.error);
      setData(a); setStats(s);
    } catch (e: any) {
      setMsg(`تعذر تحميل البيانات: ${e.message}`);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [qs, geo, focus]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (geo) fetch(`/api/facets?geo=${geo}&focus=${focus}`).then((r) => r.json()).then(setFacets).catch(() => {}); }, [geo, focus]);
  // UI auto-refresh from the database (default every 60s)
  useEffect(() => { const t = setInterval(() => refresh(true), uiRefresh * 1000); return () => clearInterval(t); }, [refresh, uiRefresh]);

  const sourceNames = useMemo(() => Object.fromEntries((stats?.sources ?? facets?.sources ?? []).map((s) => [s.id, s.name])), [stats, facets]);

  const setF = (k: keyof Filters, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const chooseGeo = (g: Geo) => { setGeo(g); store('geo', g); setPage(1); };
  const chooseFocus = (f: Focus) => { setFocus(f); store('focus', f); setPage(1); };
  const chooseSort = (s: string) => { setSort(s); store('sort', s); setPage(1); };

  async function refreshNow() {
    setRefreshing(true); setMsg(null);
    try {
      const r = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
      if (r.error) throw new Error(r.error);
      setMsg(r.note ?? `تمت جدولة تحديث ${r.queued.length} مصادر — ستظهر النتائج تلقائياً`);
      setTimeout(() => refresh(true), 15_000);
      setTimeout(() => refresh(true), 45_000);
      setTimeout(() => refresh(true), 150_000);
    } catch (e: any) {
      setMsg(`تعذر بدء التحديث: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleSave(a: AuctionItem) {
    await fetch(`/api/saved/${a.id}`, { method: a.saved ? 'DELETE' : 'POST' });
    setData((d) => d && { ...d, items: savedOnly && a.saved ? d.items.filter((x) => x.id !== a.id) : d.items.map((x) => (x.id === a.id ? { ...x, saved: a.saved ? null : { id: 'x' } } : x)) });
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const okSources = stats?.sources.filter((s) => s.status === 'ok').length ?? 0;

  const Stat = ({ label, value, k, alert }: { label: string; value?: number; k: typeof quick; alert?: boolean }) => (
    <button onClick={() => { setQuick(quick === k ? '' : k); setPage(1); }} aria-pressed={quick === k && !!k}
      className={`flex min-w-0 flex-col items-start gap-0.5 px-4 py-3 text-right transition-colors hover:bg-[var(--sunk)] ${quick === k && k ? 'bg-[var(--accent-soft)]' : ''}`}>
      <span className="label truncate">{label}</span>
      <span className={`num text-[26px] font-bold leading-tight ${alert && value ? 'text-[var(--danger)]' : quick === k && k ? 'text-[var(--accent)]' : ''}`}>{value ?? '—'}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{savedOnly ? 'المزادات المحفوظة' : focus === 'land' ? 'مزادات الأراضي' : focus === 'real_estate' ? 'المزادات العقارية' : 'لوحة المزادات'}</h1>
          <p className="muted text-sm">آخر تحديث <span className="num">{stats?.lastUpdate ? `${timeAgo(stats.lastUpdate)} · ${formatRiyadh(stats.lastUpdate)}` : '—'}</span> بتوقيت الرياض</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="نوع المزادات">
            {FOCUS.map((f) => <button key={f.v} onClick={() => chooseFocus(f.v)} aria-pressed={focus === f.v}>{f.label}</button>)}
          </div>
          <div className="seg" role="group" aria-label="النطاق الجغرافي">
            {GEO.map((g) => <button key={g.v} onClick={() => chooseGeo(g.v)} aria-pressed={geo === g.v}>{g.label}</button>)}
          </div>
          <button className="btn btn-primary" onClick={refreshNow} disabled={refreshing}>{refreshing ? 'جاري الطلب…' : 'تحديث الآن'}</button>
        </div>
      </div>

      {!savedOnly && (
        <div className="card grid grid-cols-2 divide-[var(--border)] overflow-hidden sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-x-reverse">
          <Stat label="المزادات النشطة" value={stats?.total} k="" />
          <Stat label="جارية الآن" value={stats?.live} k="live" />
          <Stat label="قادمة" value={stats?.upcoming} k="upcoming" />
          <Stat label="تنتهي اليوم" value={stats?.endingToday} k="endingToday" alert />
          <Stat label="جديدة خلال 24 ساعة" value={stats?.new24h} k="new24h" />
          <a href="/sources" className="flex flex-col items-start gap-0.5 px-4 py-3 transition-colors hover:bg-[var(--sunk)]">
            <span className="label">المنصات تعمل</span>
            <span className="num text-[26px] font-bold leading-tight">{okSources}<span className="muted text-base font-semibold"> من {stats?.sources.length ?? 0}</span></span>
            <span className="flex gap-1" aria-hidden="true">
              {stats?.sources.map((s) => <span key={s.id} title={`${s.name}: ${SOURCE_STATUS[s.status]?.label ?? s.status}`} className={`h-1.5 w-1.5 rounded-full ${SOURCE_STATUS[s.status]?.cls ?? 'bg-zinc-400'}`} />)}
            </span>
          </a>
        </div>
      )}

      {msg && <div className="card border-brand-500 p-3 text-sm">{msg} <button className="muted mr-2" onClick={() => setMsg(null)}>✕</button></div>}

      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-sm flex-1" placeholder="بحث بالاسم أو الجهة أو الموقع..." value={filters.q} onChange={(e) => setF('q', e.target.value)} />
          {focus === 'all' && (
            <select className="input w-auto" value={filters.category} onChange={(e) => setF('category', e.target.value)}>
              <option value="">كل الأنواع</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <select className="input w-auto" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
            <option value="">النشطة (جاري + قادم)</option><option value="live">جاري</option><option value="upcoming">قادم</option><option value="ended">منتهي</option><option value="all">كل الحالات</option>
          </select>
          <select className="input w-auto" value={sort} onChange={(e) => chooseSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>ترتيب: {s.label}</option>)}
          </select>
          <button className="btn" onClick={() => setShowFilters((v) => !v)}>فلاتر متقدمة {activeFilterCount > 0 && <span className="num chip bg-[var(--accent)] text-[var(--accent-ink)]">{activeFilterCount}</span>}</button>
          {activeFilterCount > 0 && <button className="btn" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>مسح</button>}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs"><span className="muted">الاستخدام</span>
              <select className="input mt-1" value={filters.usage} onChange={(e) => setF('usage', e.target.value)}>
                <option value="">كل الاستخدامات</option>{Object.entries(USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-xs"><span className="muted">نوع العقار</span>
              <select className="input mt-1" value={filters.propertyType} onChange={(e) => setF('propertyType', e.target.value)}>
                <option value="">كل الأنواع</option>{Object.entries(PROPERTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-xs sm:col-span-2"><span className="muted">مساحة قطعة الأرض (م²)</span>
              <div className="mt-1 flex gap-1"><input inputMode="numeric" className="input" placeholder="من" value={filters.minArea} onChange={(e) => setF('minArea', e.target.value.replace(/\D/g, ''))} /><input inputMode="numeric" className="input" placeholder="إلى" value={filters.maxArea} onChange={(e) => setF('maxArea', e.target.value.replace(/\D/g, ''))} /></div></label>
            <label className="text-xs"><span className="muted">المنصة</span>
              <select className="input mt-1" value={filters.source} onChange={(e) => setF('source', e.target.value)}>
                <option value="">كل المنصات</option>{facets?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></label>
            <label className="text-xs"><span className="muted">المدينة</span>
              <input className="input mt-1" list="cities" value={filters.city} onChange={(e) => setF('city', e.target.value)} placeholder="مثال: الرياض" />
              <datalist id="cities">{facets?.cities.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="text-xs"><span className="muted">الحي</span>
              <input className="input mt-1" list="districts" value={filters.district} onChange={(e) => setF('district', e.target.value)} placeholder="مثال: الملقا" />
              <datalist id="districts">{facets?.districts.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="text-xs"><span className="muted">الجهة المنظمة</span>
              <input className="input mt-1" list="orgs" value={filters.organizer} onChange={(e) => setF('organizer', e.target.value)} />
              <datalist id="orgs">{facets?.organizers.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="text-xs"><span className="muted">البداية من / إلى</span>
              <div className="mt-1 flex gap-1"><input type="date" className="input" value={filters.startFrom} onChange={(e) => setF('startFrom', e.target.value)} /><input type="date" className="input" value={filters.startTo} onChange={(e) => setF('startTo', e.target.value)} /></div></label>
            <label className="text-xs"><span className="muted">النهاية من / إلى</span>
              <div className="mt-1 flex gap-1"><input type="date" className="input" value={filters.endFrom} onChange={(e) => setF('endFrom', e.target.value)} /><input type="date" className="input" value={filters.endTo} onChange={(e) => setF('endTo', e.target.value)} /></div></label>
            <label className="text-xs"><span className="muted">نطاق السعر (ر.س) — للمزادات التي يتوفر سعرها</span>
              <div className="mt-1 flex gap-1"><input inputMode="numeric" className="input" placeholder="من" value={filters.minPrice} onChange={(e) => setF('minPrice', e.target.value.replace(/\D/g, ''))} /><input inputMode="numeric" className="input" placeholder="إلى" value={filters.maxPrice} onChange={(e) => setF('maxPrice', e.target.value.replace(/\D/g, ''))} /></div></label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="muted">{data ? <><span className="num font-semibold">{data.total}</span> مزاد{quick && ` · ${{ endingToday: 'تنتهي اليوم', new24h: 'جديدة خلال 24 ساعة', live: 'الجارية', upcoming: 'القادمة' }[quick]}`}{filters.category && ` · ${catLabel(filters.category)}`}</> : '...'}</span>
        {loading && data && <span className="muted text-xs">يتم التحديث…</span>}
      </div>

      {data && data.items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">لا توجد مزادات مطابقة</p>
          <p className="muted text-sm">{stats?.total === 0 && !savedOnly ? 'لم يتم جلب بيانات بعد — اضغط "تحديث الآن" أو شغّل الـ worker.' : 'جرّب توسيع النطاق الجغرافي أو تغيير الفلاتر.'}</p>
        </div>
      ) : (
        !data ? <GridSkeleton n={8} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" /> :
        <div key={`${geo}|${focus}|${page}|${quick}`} className="rise-list grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.items.map((a) => <AuctionCard key={a.id} a={a} sourceNames={sourceNames} onToggleSave={toggleSave} />)}
        </div>
      )}

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
