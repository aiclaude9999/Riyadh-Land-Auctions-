'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, usageLabel } from './format';
import type { DealsData, DistrictDeals } from '@/lib/deals';

interface Pin {
  id: string; lat: number; lng: number; t: string | null; pt: string | null; u: string | null; ar: number | null;
  p: number | null; cur: boolean; dp: number | null; ci: string | null; d: string | null; src: string; url: string;
  a: { id: string; title: string; status: string; startAt: string | null; endAt: string | null };
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
const pinIcon = (color: string) => L.divIcon({
  className: '', iconSize: [22, 30], iconAnchor: [11, 29], popupAnchor: [0, -26],
  html: `<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))"><path d="M11 29C11 29 21 17.5 21 11A10 10 0 0 0 1 11C1 17.5 11 29 11 29Z" fill="${color}" stroke="#fff" stroke-width="1.6"/><circle cx="11" cy="11" r="3.6" fill="#fff"/></svg>`,
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
    L.control.layers(bases, undefined, { position: 'topright', collapsed: false }).addTo(map.current);
    map.current.on('baselayerchange', (e: L.LayersControlEvent) => { try { localStorage.setItem('mapBase', e.name); } catch { /* ignore */ } });
    dealsLayer.current = L.layerGroup().addTo(map.current); // coloured districts (pins are markers, always on top)
    // metro lines above the coloured districts, below the auction pins
    map.current.createPane('metro').style.zIndex = '450';
    metroLayer.current = L.layerGroup().addTo(map.current);
    try { if (localStorage.getItem('mapMetro') === '0') setShowMetro(false); } catch { /* ignore */ }
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // load pins
  useEffect(() => {
    setPins(null); setErr(null);
    const qs = new URLSearchParams({ geo, category, ...(status ? { status } : {}) });
    fetch(`/api/map?${qs}`).then((r) => r.json()).then((d) => (Array.isArray(d) ? setPins(d) : setErr(d.error ?? 'خطأ'))).catch((e) => setErr(String(e)));
    const g = GEO.find((x) => x.v === geo)!;
    map.current?.setView(g.center, g.zoom);
  }, [geo, category, status]);

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
      const closing = p.a.status === 'upcoming' ? `يبدأ ${formatRiyadh(p.a.startAt)}` : `يغلق ${formatRiyadh(p.a.endAt)}`;
      const html = `<div dir="rtl" style="font-family:inherit;min-width:220px;line-height:1.6">
        <div style="font-weight:700;margin-bottom:2px">${esc(p.t ?? p.a.title)}</div>
        <div style="color:${color};font-weight:600">${esc(propertyLabel(p.pt) === '—' ? 'غير محدد' : propertyLabel(p.pt))}${p.u ? ' · ' + esc(usageLabel(p.u)) : ''} · ${esc(statusLabel(p.a.status))}</div>
        <div>📍 ${esc([p.d, p.ci].filter(Boolean).join('، ') || '—')}</div>
        <div>المساحة: <b>${esc(fmtArea(p.ar) ?? '—')}</b></div>
        <div>${p.cur ? 'آخر سعر' : 'الافتتاح'}: <b>${esc(fmtMoney(p.p) ?? '—')}</b> · العربون: ${esc(fmtMoney(p.dp) ?? '—')}</div>
        <div>${esc(closing)}</div>
        <div style="margin-top:4px">🔨 <a href="/auctions/${esc(p.a.id)}">${esc(p.a.title)}</a> · <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(SOURCE[p.src] ?? p.src)} ↗</a></div>
      </div>`;
      L.marker([p.lat, p.lng], { icon: pinIcon(color), riseOnHover: true }).bindPopup(html).addTo(lg);
    }
    if (shown.length && map.current) {
      const b = L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number]));
      if (b.isValid()) map.current.fitBounds(b.pad(0.15), { maxZoom: 14 });
    }
  }, [shown]);

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
      const label = `🚇 ${line.name} (${line.ref})`;
      L.polyline(line.paths, { pane: 'metro', renderer, color: '#ffffff', weight: 7, opacity: 0.9, interactive: false }).addTo(lg);
      L.polyline(line.paths, { pane: 'metro', renderer, color: line.colour, weight: 4, opacity: 1 }).bindTooltip(label, { sticky: true }).addTo(lg);
    }
    for (const line of metro) {
      for (const st of line.stations) {
        L.circleMarker([st.lat, st.lng], { pane: 'metro', renderer, radius: 4, color: line.colour, weight: 2, fillColor: '#ffffff', fillOpacity: 1 })
          .bindTooltip(`🚇 محطة ${st.name} — ${line.name}`, { direction: 'top' }).addTo(lg);
      }
    }
  }, [showMetro, metro]);
  const toggleMetro = () => setShowMetro((v) => { try { localStorage.setItem('mapMetro', v ? '0' : '1'); } catch { /* ignore */ } return !v; });

  const toggle = (t: string) => setTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">خريطة الأصول</h1>
          <p className="muted text-xs">كل أصل له موقع على الخريطة (غالباً من مباشر والسعودية للمزادات ومزادات). اضغط على النقطة للتفاصيل.</p>
        </div>
        <div className="card flex p-1 text-sm">
          {GEO.map((g) => <button key={g.v} onClick={() => setGeo(g.v)} className={`rounded-lg px-3 py-1.5 font-medium ${geo === g.v ? 'bg-brand-600 text-white' : 'muted'}`}>{g.l}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="النوع">
          <option value="real_estate">العقارات</option><option value="all">كل الأنواع</option>
        </select>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
          <option value="">النشطة (جاري + قادم)</option><option value="live">جاري</option><option value="upcoming">قادم</option><option value="all">الكل</option>
        </select>
        {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
          <button key={t} onClick={() => toggle(t)} className={`chip border px-3 py-1.5 text-sm ${types.has(t) ? 'text-white' : ''}`}
            style={{ borderColor: TYPE_COLORS[t] ?? '#6b7280', background: types.has(t) ? TYPE_COLORS[t] ?? '#6b7280' : undefined }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[t] ?? '#6b7280' }} />
            {propertyLabel(t) === '—' ? 'غير محدد' : propertyLabel(t)} <span className="num opacity-75">{n}</span>
          </button>
        ))}
        <select className="input w-auto" value={dealsMode} onChange={(e) => setDealsMode(e.target.value as 'off' | MetricKey)} aria-label="تلوين الأحياء">
          <option value="off">تلوين الأحياء: إيقاف</option>
          {(Object.keys(METRICS) as MetricKey[]).map((k) => <option key={k} value={k}>تلوين الأحياء: {METRICS[k].label}</option>)}
        </select>
        {dealsMode !== 'off' && deals && (
          <select className="input w-auto" value={dealsQ} onChange={(e) => setDealsQ(e.target.value)} aria-label="الفترة">
            <option value="all">{qLabel('all')} ({deals.quarters.reduce((s, q) => s + q.mapped, 0)} صفقة)</option>
            {[...deals.quarters].reverse().map((q) => <option key={q.q} value={q.q}>{qLabel(q.q)} ({q.mapped} صفقة)</option>)}
          </select>
        )}
        <button onClick={toggleMetro} className={`chip border px-3 py-1.5 text-sm ${showMetro ? 'border-sky-600 bg-sky-600 text-white' : ''}`} aria-pressed={showMetro}>
          🚇 مترو الرياض
        </button>
        <span className="muted text-sm">{pins ? `${shown.length} أصل على الخريطة` : err ? `تعذر التحميل: ${err}` : 'جاري التحميل…'}</span>
      </div>
      <div ref={el} className="card overflow-hidden" style={{ height: 'min(70vh, 640px)', minHeight: 360 }} />
      {metric && deals && (
        <div className="card space-y-2 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <b>{metric.label} ({metric.unit}) · {qLabel(dealsQ)}:</b>
            {DEAL_COLORS.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                <span className="inline-block h-3 w-4 rounded-sm border" style={{ background: c }} />
                <span className="num" dir="ltr">{i === 0 ? `< ${sar(breaks[0] ?? null)}` : i === DEAL_COLORS.length - 1 ? `${sar(breaks[i - 1] ?? null)}+` : `${sar(breaks[i - 1] ?? null)}–${sar(breaks[i] ?? null)}`}</span>
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-4 rounded-sm border border-dashed border-gray-400 bg-gray-100" />
              لا توجد بيانات كافية (أقل من {MIN_DEALS} صفقات)
            </span>
            <span className="muted">· {rated.length} حي ملوّن · 📍 الدبابيس = أصول المزادات</span>
          </div>
          {rated.length === 0 && <div className="text-amber-700">لا توجد صفقات كافية لمدينة الرياض في ملف وزارة العدل لهذه الفترة.</div>}
          <div className="muted">
            المصدر: وزارة العدل، البيانات المفتوحة (open.data.gov.sa)، صفقات مدينة الرياض فقط. حدود الأحياء من خريطة العنوان الوطني (سبل). السعر = الوسيط لكل حي؛ الملف لا يحتوي على موقع العقار داخل الحي ولا نوعه.
            ملفات الوزارة تحتوي على عدد صفقات للرياض أقل بكثير من مؤشرات الهيئة العامة للعقار، وقد انخفض العدد كل ربع
            ({deals.quarters.map((q) => `${qLabel(q.q)}: ${q.riyadhDeals}`).join('، ')}) — لذا اعتبر الأسعار مؤشراً تقريبياً.
          </div>
        </div>
      )}
      {showMetro && metro && (
        <div className="muted flex flex-wrap items-center gap-3 text-xs">
          <b>🚇 مترو الرياض:</b>
          {metro.map((l) => (
            <span key={l.ref} className="flex items-center gap-1"><span className="inline-block h-1.5 w-5 rounded" style={{ background: l.colour }} />{l.name}</span>
          ))}
          <span>· الدوائر البيضاء = المحطات · البيانات © مساهمو OpenStreetMap</span>
        </div>
      )}
      <p className="muted text-xs">لا تظهر هنا الأصول التي لا يذكر مصدرها موقعاً دقيقاً (مثل بعض أصول إنفاذ وسومتك) — تجدها في صفحة العقارات.</p>
    </div>
  );
}
