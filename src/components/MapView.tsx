'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtArea, fmtMoney, formatRiyadh, propertyLabel, statusLabel, usageLabel } from './format';

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
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export default function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
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
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
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
        <span className="muted text-sm">{pins ? `${shown.length} أصل على الخريطة` : err ? `تعذر التحميل: ${err}` : 'جاري التحميل…'}</span>
      </div>
      <div ref={el} className="card overflow-hidden" style={{ height: 'min(70vh, 640px)', minHeight: 360 }} />
      <p className="muted text-xs">لا تظهر هنا الأصول التي لا يذكر مصدرها موقعاً دقيقاً (مثل بعض أصول إنفاذ وسومتك) — تجدها في صفحة العقارات.</p>
    </div>
  );
}
