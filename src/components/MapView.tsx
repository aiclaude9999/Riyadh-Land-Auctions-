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
const SOURCE: Record<string, string> = { mobasher: 'مباشر', 'saudia-auctions': 'السعودية للمزادات', mazadat: 'مزادات', tarsyah: 'ترسية', qemah: 'قمة', soum: 'سومتك', infath: 'إنفاذ' };
const GEO = [
  { v: 'riyadh_city', l: 'مدينة الرياض', center: [24.7136, 46.6753] as [number, number], zoom: 10 },
  { v: 'riyadh_region', l: 'منطقة الرياض', center: [24.5, 46.0] as [number, number], zoom: 7 },
  { v: 'all', l: 'كل المملكة', center: [23.9, 45.0] as [number, number], zoom: 5 },
];
// Deals layer (Ministry of Justice sales): cheap → expensive SAR/m², 5 classes
const DEAL_COLORS = ['#fde68a', '#fbbf24', '#f97316', '#dc2626', '#7f1d1d'];
const qLabel = (q: string) => (q === 'all' ? 'كل الأرباع' : q.replace(/^(\d{4})-Q(\d)$/, (_, y, n) => `الربع ${['', 'الأول', 'الثاني', 'الثالث', 'الرابع'][+n]} ${y}`));
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
  const [dealsMode, setDealsMode] = useState<'off' | 'all' | 'land'>('off');
  const [dealsQ, setDealsQ] = useState('');
  const [deals, setDeals] = useState<DealsData | null>(null);
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
    dealsLayer.current = L.layerGroup().addTo(map.current); // under the auction pins
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
      L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.9 }).bindPopup(html).addTo(lg);
    }
    if (shown.length && map.current) {
      const b = L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number]));
      if (b.isValid()) map.current.fitBounds(b.pad(0.15), { maxZoom: 14 });
    }
  }, [shown]);

  // load the deals summary only when the layer is switched on
  useEffect(() => {
    if (dealsMode === 'off' || deals) return;
    import('@/data/riyadh-deals.json').then((m) => {
      const d = (m.default ?? m) as unknown as DealsData;
      setDeals(d);
      const latest = [...d.quarters].reverse().find((q) => q.mapped >= 100);
      setDealsQ((cur) => cur || latest?.q || 'all');
    }).catch((e) => setErr(String(e)));
  }, [dealsMode, deals]);

  const dealRows = useMemo(() => {
    if (!deals || dealsMode === 'off') return [] as DistrictDeals[];
    return deals.rows.filter((r) => r.q === dealsQ && (dealsMode === 'land' ? r.ml != null : r.m != null));
  }, [deals, dealsMode, dealsQ]);
  const breaks = useMemo(() => quantileBreaks(dealRows.map((r) => (dealsMode === 'land' ? r.ml! : r.m!))), [dealRows, dealsMode]);

  // draw the deals circles (one per district)
  useEffect(() => {
    const lg = dealsLayer.current;
    if (!lg) return;
    lg.clearLayers();
    for (const r of dealRows) {
      const val = (dealsMode === 'land' ? r.ml : r.m)!;
      const cls = breaks.filter((b) => val >= b).length;
      const color = DEAL_COLORS[cls];
      const count = dealsMode === 'land' ? r.nl : r.n;
      const html = `<div dir="rtl" style="font-family:inherit;min-width:220px;line-height:1.7">
        <div style="font-weight:700">حي ${esc(r.d)}</div>
        <div class="muted" style="font-size:12px">صفقات وزارة العدل · ${esc(qLabel(r.q))}</div>
        <div>متوسط سعر المتر (الوسيط) — كل الصفقات: <b>${sar(r.m)} ريال</b></div>
        <div>الأراضي (تقدير): <b>${sar(r.ml)} ريال/م²</b> · ${r.nl} صفقة</div>
        <div>عدد الصفقات: <b>${r.n}</b> (سكني ${r.nr} · تجاري ${r.nc})</div>
        <div>إجمالي القيمة: ${esc(fmtMoney(r.v) ?? '—')}</div>
        <div class="muted" style="font-size:11px;margin-top:4px">موقع الدائرة = وسط الحي، وليس موقع العقار. "أرض" تقدير: صفقة سكنية لعقار واحد مساحته أكبر من 200 م².</div>
      </div>`;
      L.circleMarker([r.lat, r.lng], {
        radius: Math.max(6, Math.min(26, 4 + Math.sqrt(count) * 2.2)), color: '#7c2d12', weight: 1, fillColor: color, fillOpacity: 0.55,
      }).bindPopup(html).bindTooltip(`${r.d}: ${sar(val)} ريال/م²`, { direction: 'top' }).addTo(lg);
    }
  }, [dealRows, breaks, dealsMode]);

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
        <select className="input w-auto" value={dealsMode} onChange={(e) => setDealsMode(e.target.value as 'off' | 'all' | 'land')} aria-label="طبقة أسعار الصفقات">
          <option value="off">أسعار الصفقات: إخفاء</option><option value="all">أسعار الصفقات: كل الصفقات</option><option value="land">أسعار الصفقات: الأراضي (تقدير)</option>
        </select>
        {dealsMode !== 'off' && deals && (
          <select className="input w-auto" value={dealsQ} onChange={(e) => setDealsQ(e.target.value)} aria-label="الفترة">
            {[...deals.quarters].reverse().map((q) => <option key={q.q} value={q.q}>{qLabel(q.q)} ({q.mapped} صفقة)</option>)}
            <option value="all">كل الأرباع معاً</option>
          </select>
        )}
        <span className="muted text-sm">{pins ? `${shown.length} أصل على الخريطة` : err ? `تعذر التحميل: ${err}` : 'جاري التحميل…'}</span>
      </div>
      <div ref={el} className="card overflow-hidden" style={{ height: 'min(70vh, 640px)', minHeight: 360 }} />
      {dealsMode !== 'off' && deals && (
        <div className="card space-y-2 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <b>سعر المتر (ريال) — {dealsMode === 'land' ? 'الأراضي (تقدير)' : 'كل الصفقات'} · {qLabel(dealsQ)}:</b>
            {DEAL_COLORS.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full border" style={{ background: c }} />
                <span className="num" dir="ltr">{i === 0 ? `< ${sar(breaks[0] ?? null)}` : i === DEAL_COLORS.length - 1 ? `${sar(breaks[i - 1] ?? null)}+` : `${sar(breaks[i - 1] ?? null)}–${sar(breaks[i] ?? null)}`}</span>
              </span>
            ))}
            <span className="muted">· حجم الدائرة = عدد الصفقات · {dealRows.length} حي</span>
          </div>
          {dealRows.length === 0 && <div className="text-amber-700">لا توجد صفقات لمدينة الرياض في ملف وزارة العدل لهذه الفترة.</div>}
          <div className="muted">
            المصدر: وزارة العدل، البيانات المفتوحة (open.data.gov.sa)، صفقات مدينة الرياض فقط. يظهر كل حي في وسطه لأن الملف لا يحتوي على موقع العقار ولا نوعه.
            ملفات الوزارة تحتوي على عدد صفقات للرياض أقل بكثير من مؤشرات الهيئة العامة للعقار، وقد انخفض العدد كل ربع
            ({deals.quarters.map((q) => `${qLabel(q.q)}: ${q.riyadhDeals}`).join('، ')}) — لذا اعتبر الأسعار مؤشراً تقريبياً.
          </div>
        </div>
      )}
      <p className="muted text-xs">لا تظهر هنا الأصول التي لا يذكر مصدرها موقعاً دقيقاً (مثل بعض أصول إنفاذ وسومتك) — تجدها في صفحة العقارات.</p>
    </div>
  );
}
