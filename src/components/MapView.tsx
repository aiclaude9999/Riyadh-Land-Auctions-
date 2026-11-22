'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, usageLabel } from './format';
import type { DealsData, DistrictDeals } from '@/lib/deals';
import type { Insights } from '@/lib/insights';
import Link from 'next/link';
import AssetInsights, { PriceMark } from './AssetInsights';
import { Cover } from './Cover';
import { Icon } from './Icon';
import { Countdown } from './Countdown';
import { STATUS_STYLE } from './format';

interface Pin {
  id: string; lat: number; lng: number; t: string | null; pt: string | null; u: string | null; ar: number | null;
  p: number | null; cur: boolean; dp: number | null; ci: string | null; d: string | null; src: string; url: string;
  a: { id: string; title: string; status: string; startAt: string | null; endAt: string | null };
  nt?: string | null;
  ins?: Insights | null;
  img?: string | null; ss?: number | null; sw?: number | null; co?: boolean | null;
}

const TYPE_COLORS: Record<string, string> = {
  land: '#b45309', villa: '#2563eb', building: '#7c3aed', apartment: '#0891b2', rest_house: '#16a34a', farm: '#65a30d', commercial: '#db2777', other: '#6b7280',
};
const SOURCE: Record<string, string> = { mobasher: 'مباشر', 'saudia-auctions': 'السعودية للمزادات', mazadat: 'مزادات', tarsyah: 'ترسية', qemah: 'قمة', soum: 'سومتك', infath: 'إنفاذ', 'infath-auctions': 'إنفاذ للمزادات' };
const GEO = [
  { v: 'riyadh_city', l: 'مدينة الرياض', center: [24.7136, 46.6753] as [number, number], zoom: 10 },
  { v: 'riyadh_region', l: 'منطقة الرياض', center: [24.5, 46.0] as [number, number], zoom: 7 },
  { v: 'all', l: 'كل المملكة', center: [23.9, 45.0] as [number, number], zoom: 5 },
];
// Deals layer (Ministry of Justice sales): cheap → expensive SAR/m², 5 classes
const DEAL_COLORS = ['#fde68a', '#fbbf24', '#f97316', '#dc2626', '#7f1d1d'];
const qLabel = (q: string) => (q === 'all' ? 'كل الأرباع معاً' : q.replace(/^(\d{4})-Q(\d)$/, (_, y, n) => `الربع ${['', 'الأول', 'الثاني', 'الثالث', 'الرابع'][+n]} ${y}`));
const MIN_DEALS = 3; // fewer deals than this → district shown grey (not enough data)
type MetricKey = 'land' | 'all' | 'res' | 'com' | 'count';
const METRICS: Record<MetricKey, { label: string; unit: string; value: (r: DistrictDeals) => number | null; count: (r: DistrictDeals) => number }> = {
  land: { label: 'سعر متر الأراضي (تقدير)', unit: 'ريال/م²', value: (r) => r.ml, count: (r) => r.nl },
  all: { label: 'سعر المتر — كل الصفقات', unit: 'ريال/م²', value: (r) => r.m, count: (r) => r.n },
  res: { label: 'سعر المتر — السكني', unit: 'ريال/م²', value: (r) => r.mr, count: (r) => r.nr },
  com: { label: 'سعر المتر — التجاري', unit: 'ريال/م²', value: (r) => r.mc, count: (r) => r.nc },
  count: { label: 'عدد الصفقات', unit: 'صفقة', value: (r) => r.n, count: (r) => r.n },
};
interface Shape { name: string; rings: [number, number][][] }
interface MetroLine { ref: string; name: string; nameEn: string; colour: string; paths: [number, number][][]; stations: { name: string; lat: number; lng: number }[] }
/** Drop-pin icon for auction assets (so they don't look like the coloured districts). */
const pinIcon = (color: string, big = false) => L.divIcon({
  className: '', iconSize: big ? [32, 44] : [22, 30], iconAnchor: big ? [16, 43] : [11, 29], popupAnchor: [0, -26],
  html: `<svg width="${big ? 32 : 22}" height="${big ? 44 : 30}" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))"><path d="M11 29C11 29 21 17.5 21 11A10 10 0 0 0 1 11C1 17.5 11 29 11 29Z" fill="${color}" stroke="#fff" stroke-width="1.6"/><circle cx="11" cy="11" r="3.6" fill="#fff"/></svg>`,
});
const sar = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
function quantileBreaks(values: number[], k = DEAL_COLORS.length): number[] {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return [];
  return Array.from({ length: k - 1 }, (_, i) => s[Math.min(s.length - 1, Math.floor(((i + 1) * s.length) / k))]);
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export default function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const dealsLayer = useRef<L.LayerGroup | null>(null);
  const [dealsMode, setDealsMode] = useState<'off' | MetricKey>('land');
  const [dealsQ, setDealsQ] = useState('all');
  const [deals, setDeals] = useState<DealsData | null>(null);
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const metroLayer = useRef<L.LayerGroup | null>(null);
  const [showMetro, setShowMetro] = useState(true);
  const [metro, setMetro] = useState<MetroLine[] | null>(null);
  const [geo, setGeo] = useState('riyadh_city');
  const [category, setCategory] = useState('real_estate');
  const [status, setStatus] = useState('');
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [pins, setPins] = useState<Pin[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Pin | null>(null);
  const [panel, setPanel] = useState(false); // phone: filters sheet

  // create the map once
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { center: GEO[0].center, zoom: GEO[0].zoom, preferCanvas: true });
    // Base maps (both free): OpenStreetMap streets, and Esri World Imagery satellite photos
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const esriAttr = 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics';
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: esriAttr });
    const hybrid = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: esriAttr }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    ]);
    const bases: Record<string, L.Layer> = { 'خريطة الشوارع': streets, 'قمر صناعي': satellite, 'قمر صناعي + الطرق والأسماء': hybrid };
    let saved = 'خريطة الشوارع';
    try { saved = localStorage.getItem('mapBase') ?? saved; } catch { /* ignore */ }
    (bases[saved] ?? streets).addTo(map.current);
    L.control.layers(bases, undefined, { position: 'topleft', collapsed: true }).addTo(map.current);
    map.current.on('click', () => setSel(null));
    map.current.on('baselayerchange', (e: L.LayersControlEvent) => { try { localStorage.setItem('mapBase', e.name); } catch { /* ignore */ } });
    dealsLayer.current = L.layerGroup().addTo(map.current); // coloured districts (pins are markers, always on top)
    // metro lines above the coloured districts, below the auction pins
    map.current.createPane('metro').style.zIndex = '450';
    metroLayer.current = L.layerGroup().addTo(map.current);
    try { if (localStorage.getItem('mapMetro') === '0') setShowMetro(false); } catch { /* ignore */ }
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // load pins (and refresh them every 5 minutes while the page is visible, without moving the map)
  const [tick, setTick] = useState(0);
  const fitNext = useRef(true);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') setTick((x) => x + 1); }, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fitNext.current = true;
    const g = GEO.find((x) => x.v === geo)!;
    map.current?.setView(g.center, g.zoom);
    setPins(null);
    setSel(null);
  }, [geo, category, status]);
  useEffect(() => {
    setErr(null);
    const qs = new URLSearchParams({ geo, category, ...(status ? { status } : {}) });
    fetch(`/api/map?${qs}`).then((r) => r.json()).then((d) => (Array.isArray(d) ? setPins(d) : setErr(d.error ?? 'خطأ'))).catch((e) => setErr(String(e)));
  }, [geo, category, status, tick]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    pins?.forEach((p) => { const k = p.pt ?? 'other'; c[k] = (c[k] ?? 0) + 1; });
    return c;
  }, [pins]);
  const shown = useMemo(() => (pins ?? []).filter((p) => !types.size || types.has(p.pt ?? 'other')), [pins, types]);

  // draw markers
  useEffect(() => {
    const lg = layer.current;
    if (!lg) return;
    lg.clearLayers();
    for (const p of shown) {
      const color = TYPE_COLORS[p.pt ?? 'other'] ?? TYPE_COLORS.other;
      L.marker([p.lat, p.lng], { icon: pinIcon(color, sel?.id === p.id), riseOnHover: true, zIndexOffset: sel?.id === p.id ? 1000 : 0 })
        .on('click', () => setSel(p)).addTo(lg);
    }
    if (shown.length && map.current && fitNext.current) {
      fitNext.current = false; // only after a filter change, not on the 5-minute refresh
      const b = L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number]));
      if (b.isValid()) map.current.fitBounds(b.pad(0.15), { maxZoom: 14 });
    }
  }, [shown, sel]);

  // load deal summaries + district boundaries (only while the layer is on)
  useEffect(() => {
    if (dealsMode === 'off' || deals) return;
    Promise.all([import('@/data/riyadh-deals.json'), import('@/data/riyadh-district-shapes.json')]).then(([d, sh]) => {
      setShapes((sh.default ?? sh) as unknown as Shape[]);
      setDeals((d.default ?? d) as unknown as DealsData);
    }).catch((e) => setErr(String(e)));
  }, [dealsMode, deals]);

  const metric = dealsMode === 'off' ? null : METRICS[dealsMode];
  // district boundary name → deals record for the chosen period
  const byShape = useMemo(() => {
    const m = new Map<string, DistrictDeals>();
    deals?.rows.filter((r) => r.q === dealsQ).forEach((r) => r.p.forEach((name) => m.set(name, r)));
    return m;
  }, [deals, dealsQ]);
  const rated = useMemo(() => {
    if (!metric) return [] as DistrictDeals[];
    return [...new Set(byShape.values())].filter((r) => metric.count(r) >= MIN_DEALS && metric.value(r) != null);
  }, [byShape, metric]);
  const breaks = useMemo(() => (metric ? quantileBreaks(rated.map((r) => metric.value(r)!)) : []), [rated, metric]);

  // per-quarter land price of one district (popup)
  const trendHtml = (shapeName: string) => {
    if (!deals) return '';
    const rows = deals.rows.filter((r) => r.q !== 'all' && r.p.includes(shapeName)).sort((a, b) => a.q.localeCompare(b.q));
    if (rows.length < 2) return '';
    return `<div style="margin-top:4px"><b>حسب الربع (أراضي · كل الصفقات):</b>${rows.map((r) => `<div>${esc(qLabel(r.q))}: ${r.nl >= MIN_DEALS ? sar(r.ml) : '—'} · ${r.n >= MIN_DEALS ? sar(r.m) : '—'} (${r.n} صفقة)</div>`).join('')}</div>`;
  };

  // colour every district by the chosen metric
  useEffect(() => {
    const lg = dealsLayer.current;
    if (!lg) return;
    lg.clearLayers();
    if (!metric || !shapes) return;
    const ok = new Set(rated);
    for (const sh of shapes) {
      const name = sh.name.replace(/^حي\s+/, '');
      const r = byShape.get(sh.name);
      const val = r && ok.has(r) ? metric.value(r)! : null;
      const color = val == null ? null : DEAL_COLORS[breaks.filter((b) => val >= b).length];
      const html = r
        ? `<div dir="rtl" style="font-family:inherit;min-width:230px;line-height:1.7">
        <div style="font-weight:700">حي ${esc(name)}</div>
        <div style="font-size:12px;color:#6b7280">صفقات وزارة العدل · ${esc(qLabel(r.q))}${r.p.length > 1 ? ' · ' + esc(r.d) + ' (يشمل ' + r.p.length + ' أجزاء)' : ''}</div>
        <div>الأراضي (تقدير): <b>${sar(r.ml)}</b> ريال/م² · ${r.nl} صفقة</div>
        <div>كل الصفقات: <b>${sar(r.m)}</b> ريال/م² · ${r.n} صفقة</div>
        <div>السكني: <b>${sar(r.mr)}</b> ريال/م² · ${r.nr} صفقة</div>
        <div>التجاري: <b>${sar(r.mc)}</b> ريال/م² · ${r.nc} صفقة</div>
        <div>إجمالي القيمة: ${esc(fmtMoney(r.v) ?? '—')}</div>
        ${trendHtml(sh.name)}
        <div style="font-size:11px;color:#6b7280;margin-top:4px">السعر = الوسيط (نصف الصفقات أقل منه ونصفها أعلى). "أرض" تقدير: صفقة سكنية لعقار واحد مساحته أكبر من 200 م².${val == null ? ' عدد الصفقات قليل (أقل من ' + MIN_DEALS + ') فلم يُلوَّن الحي.' : ''}</div>
      </div>`
        : `<div dir="rtl" style="font-family:inherit"><b>حي ${esc(name)}</b><br>لا توجد صفقات في ملف وزارة العدل لهذه الفترة.</div>`;
      const poly = L.polygon(sh.rings.map((ring) => [ring]) as L.LatLngExpression[][][], color
        ? { color: '#78350f', weight: 0.8, opacity: 0.7, fillColor: color, fillOpacity: 0.6 }
        : { color: '#9ca3af', weight: 0.8, opacity: 0.9, dashArray: '3 3', fillColor: '#e5e7eb', fillOpacity: 0.08 });
      poly.bindPopup(html).bindTooltip(`${esc(name)}: ${val == null ? 'لا توجد بيانات كافية' : `${sar(val)} ${metric.unit}`}`, { sticky: true, direction: 'top' });
      poly.on('mouseover', () => poly.setStyle({ weight: 2.5, opacity: 1 })).on('mouseout', () => poly.setStyle({ weight: 0.8, opacity: color ? 0.7 : 0.9 }));
      poly.addTo(lg);
    }
  }, [shapes, byShape, rated, breaks, metric]);

  // Riyadh Metro (OpenStreetMap data), loaded on first use
  useEffect(() => {
    if (!showMetro || metro) return;
    import('@/data/riyadh-metro.json').then((m) => setMetro(((m.default ?? m) as unknown as { lines: MetroLine[] }).lines)).catch((e) => setErr(String(e)));
  }, [showMetro, metro]);
  useEffect(() => {
    const lg = metroLayer.current;
    if (!lg) return;
    lg.clearLayers();
    if (!showMetro || !metro) return;
    const renderer = L.svg({ pane: 'metro' });
    for (const line of metro) {
      const label = `مترو: ${line.name} (${line.ref})`;
      L.polyline(line.paths, { pane: 'metro', renderer, color: '#ffffff', weight: 7, opacity: 0.9, interactive: false }).addTo(lg);
      L.polyline(line.paths, { pane: 'metro', renderer, color: line.colour, weight: 4, opacity: 1 }).bindTooltip(label, { sticky: true }).addTo(lg);
    }
    for (const line of metro) {
      for (const st of line.stations) {
        L.circleMarker([st.lat, st.lng], { pane: 'metro', renderer, radius: 4, color: line.colour, weight: 2, fillColor: '#ffffff', fillOpacity: 1 })
          .bindTooltip(`محطة ${st.name} — ${line.name}`, { direction: 'top' }).addTo(lg);
      }
    }
  }, [showMetro, metro]);
  const toggleMetro = () => setShowMetro((v) => { try { localStorage.setItem('mapMetro', v ? '0' : '1'); } catch { /* ignore */ } return !v; });

  const toggle = (t: string) => setTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  // keep Leaflet's size right when the layout around it changes (panel, card)
  useEffect(() => { const t = setTimeout(() => map.current?.invalidateSize(), 50); return () => clearTimeout(t); }, [panel]);

  const filters = (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h2 className="label font-semibold">ما يظهر على الخريطة</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="النوع">
            <option value="real_estate">العقارات</option><option value="all">كل الأنواع</option>
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
            <option value="">النشطة</option><option value="live">جاري</option><option value="upcoming">قادم</option><option value="all">الكل</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => {
            const on = types.has(t), c = TYPE_COLORS[t] ?? '#6b7280';
            return (
              <button key={t} onClick={() => toggle(t)} aria-pressed={on} className="press chip min-h-[2.1rem] border px-3 text-[13px]"
                style={{ borderColor: on ? c : 'var(--border)', background: on ? c : 'var(--card)', color: on ? '#fff' : 'var(--text)' }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: on ? '#fff' : c }} />
                {propertyLabel(t) === '—' ? 'غير محدد' : propertyLabel(t)} <span className="num opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
        {types.size > 0 && <button className="link text-xs" onClick={() => setTypes(new Set())}>عرض كل الأنواع</button>}
      </section>

      <section className="space-y-2">
        <h2 className="label font-semibold">تلوين الأحياء حسب صفقات وزارة العدل</h2>
        <select className="input" value={dealsMode} onChange={(e) => setDealsMode(e.target.value as 'off' | MetricKey)} aria-label="تلوين الأحياء">
          <option value="off">إيقاف</option>
          {(Object.keys(METRICS) as MetricKey[]).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
        </select>
        {dealsMode !== 'off' && deals && (
          <select className="input" value={dealsQ} onChange={(e) => setDealsQ(e.target.value)} aria-label="الفترة">
            <option value="all">{qLabel('all')} ({deals.quarters.reduce((s, q) => s + q.mapped, 0)} صفقة)</option>
            {[...deals.quarters].reverse().map((q) => <option key={q.q} value={q.q}>{qLabel(q.q)} ({q.mapped} صفقة)</option>)}
          </select>
        )}
        {metric && deals && (
          <div className="space-y-1.5 text-xs">
            <div className="flex overflow-hidden rounded-md">
              {DEAL_COLORS.map((c) => <span key={c} className="h-2.5 flex-1" style={{ background: c }} />)}
            </div>
            <div className="num muted flex justify-between" dir="ltr">
              <span>{sar(breaks[0] ?? null)}&minus;</span><span>{sar(breaks[breaks.length - 1] ?? null)}+</span>
            </div>
            <div className="muted">{metric.unit} · {rated.length} حي ملوّن · المخطط الرمادي = صفقات أقل من {MIN_DEALS}</div>
            {rated.length === 0 && <div className="text-amber-700">لا توجد صفقات كافية لهذه الفترة.</div>}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <button onClick={toggleMetro} aria-pressed={showMetro}
          className={`press flex w-full items-center justify-between rounded-lg border px-3 py-2.5 font-semibold ${showMetro ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)]'}`}>
          <span className="flex items-center gap-2"><Icon name="metro" />مترو الرياض</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${showMetro ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${showMetro ? 'left-0.5' : 'left-[18px]'}`} />
          </span>
        </button>
        {showMetro && metro && (
          <div className="muted grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {metro.map((l) => <span key={l.ref} className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-4 rounded" style={{ background: l.colour }} />{l.name}</span>)}
          </div>
        )}
      </section>

      <details className="muted text-[11px] leading-relaxed">
        <summary className="cursor-pointer font-semibold">عن البيانات</summary>
        <p className="mt-1">صفقات وزارة العدل (open.data.gov.sa)، مدينة الرياض فقط؛ السعر = الوسيط لكل حي، تقريبي. حدود الأحياء من العنوان الوطني (سبل). المترو © مساهمو OpenStreetMap.
          {deals && ` عدد الصفقات لكل ربع: ${deals.quarters.map((q) => `${qLabel(q.q)}: ${q.riyadhDeals}`).join('، ')}.`}</p>
        <p className="mt-1">لا تظهر الأصول التي لا يذكر مصدرها موقعاً دقيقاً — تجدها في صفحة العقارات.</p>
      </details>
    </div>
  );

  const card = sel && (
    <div className="drop absolute inset-x-2 bottom-2 z-[1000] mx-auto max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[0_16px_40px_-12px_rgba(16,33,27,.35)] sm:inset-x-auto sm:left-3 sm:w-[380px]">
      <div className="flex">
        <div className="w-28 flex-none sm:w-32">
          <Cover src={sel.img} ratio="h-full min-h-[132px]" figure={null} caption={propertyLabel(sel.pt) === '—' ? null : propertyLabel(sel.pt)}>
            {sel.ins?.verdict && <span className="absolute inset-x-1 top-1 flex justify-center [&>span]:static [&>span]:px-2 [&>span]:text-[11px]"><PriceMark verdict={sel.ins.verdict} diff={sel.ins.diffPct} /></span>}
          </Cover>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 p-3 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              <span className={`chip ${STATUS_STYLE[sel.a.status]}`}>{statusLabel(sel.a.status)}</span>
              <span className="chip chip-quiet">{propertyLabel(sel.pt) === '—' ? 'غير محدد' : propertyLabel(sel.pt)}{sel.u ? ` · ${usageLabel(sel.u)}` : ''}</span>
            </div>
            <button onClick={() => setSel(null)} className="muted -m-1 rounded-md p-1 hover:text-[var(--text)]" aria-label="إغلاق"><Icon name="close" size={16} /></button>
          </div>
          <Link href={`/auctions/${sel.a.id}`} className="line-clamp-2 text-[14px] font-bold leading-snug hover:text-[var(--accent)]">{sel.t ?? sel.a.title}</Link>
          <div className="muted truncate">{[sel.d && `حي ${String(sel.d).replace(/^حي\s+/, '')}`, sel.ci].filter(Boolean).join('، ') || '—'} · {SOURCE[sel.src] ?? sel.src}</div>
          <div className="num grid grid-cols-3 gap-1 rounded-lg bg-[var(--sunk)] px-2 py-1.5">
            <div><div className="label">المساحة</div><div className="font-bold">{fmtArea(sel.ar) ?? '—'}</div></div>
            <div><div className="label">{sel.cur ? 'آخر سعر' : 'الافتتاح'}</div><div className="font-bold">{fmtMoney(sel.p) ?? '—'}</div></div>
            <div><div className="label">العربون</div><div className="font-bold">{fmtMoney(sel.dp) ?? '—'}</div></div>
          </div>
          <div className="muted">{sel.a.status === 'live' && sel.a.endAt ? <>يغلق خلال <Countdown to={sel.a.endAt} compact /></> : sel.a.status === 'upcoming' ? `يبدأ ${formatRiyadh(sel.a.startAt)}` : `أغلق ${formatRiyadh(sel.a.endAt)}`}</div>
        </div>
      </div>
      {(sel.ins || sel.ss || sel.co) && (
        <div className="max-h-40 overflow-y-auto border-t border-[var(--border)] px-3 py-2">
          <AssetInsights ins={sel.ins} area={sel.ar} price={sel.p} deposit={sel.dp} asset={{ latitude: sel.lat, longitude: sel.lng, streetSides: sel.ss, streetWidth: sel.sw, corner: sel.co }} />
        </div>
      )}
      <div className="flex gap-2 border-t border-[var(--border)] p-2">
        <Link href={`/auctions/${sel.a.id}`} className="btn btn-primary press flex-1 text-[13px]">تفاصيل المزاد</Link>
        <a href={sel.url} target="_blank" rel="noreferrer" className="btn press text-[13px]">{SOURCE[sel.src] ?? sel.src}<Icon name="external" size={14} /></a>
        <a href={`https://www.google.com/maps?q=${sel.lat},${sel.lng}`} target="_blank" rel="noreferrer" className="btn press px-3" aria-label="فتح في خرائط Google"><Icon name="map" size={16} /></a>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">خريطة الأصول</h1>
          <p className="muted text-sm">{pins ? <><span className="num font-semibold text-[var(--text)]">{shown.length}</span> أصل على الخريطة · اضغط على الدبوس للتفاصيل</> : err ? `تعذر التحميل: ${err}` : 'جاري تحميل الأصول…'}</p>
        </div>
        <div className="seg" role="group" aria-label="النطاق الجغرافي">
          {GEO.map((g) => <button key={g.v} onClick={() => setGeo(g.v)} aria-pressed={geo === g.v}>{g.l}</button>)}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <aside className="card hidden max-h-[calc(100dvh-210px)] min-h-[520px] overflow-y-auto p-4 lg:block">{filters}</aside>
        <div className="relative">
          <div ref={el} className="card h-[64dvh] min-h-[380px] overflow-hidden lg:h-[calc(100dvh-210px)] lg:min-h-[520px]" />
          {!pins && !err && <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center"><span className="skeleton rounded-full px-4 py-2 text-xs" style={{ opacity: .9 }}>جاري تحميل الأصول…</span></div>}
          <button onClick={() => setPanel(true)} className="btn press absolute right-2 top-2 z-[1000] shadow-md lg:hidden"><Icon name="filter" size={16} />الفلاتر والطبقات{types.size ? <span className="num chip bg-[var(--accent)] text-[var(--accent-ink)]">{types.size}</span> : null}</button>
          {card}
        </div>
      </div>
      {panel && (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true" aria-label="الفلاتر والطبقات">
          <button className="absolute inset-0 bg-black/30" onClick={() => setPanel(false)} aria-label="إغلاق" />
          <div className="sheet-in absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-[var(--card)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">الفلاتر والطبقات</h2><button className="btn" onClick={() => setPanel(false)}>تم</button></div>
            {filters}
          </div>
        </div>
      )}
    </div>
  );
}
