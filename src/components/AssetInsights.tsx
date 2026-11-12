import Link from 'next/link';
import type { Insights } from '@/lib/insights';
import { featuresLabel } from '@/lib/plot';

const sar = (n?: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (d: number) => `${Math.abs(Math.round(d * 100))}%`;

export const VERDICT: Record<NonNullable<Insights['verdict']>, { label: string; cls: string; dot: string }> = {
  below: { label: 'أقل من سعر الحي', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100', dot: '🟢' },
  near: { label: 'قريب من سعر الحي', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100', dot: '🟡' },
  above: { label: 'أعلى من سعر الحي', cls: 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100', dot: '🔴' },
};

/** Price check, suggested max bid, metro distance and white-land warning for one asset (Riyadh only). */
interface AssetLike { streetSides?: number | null; streetWidth?: number | null; corner?: boolean | null; latitude?: number | null; longitude?: number | null }

/** Google Maps searches around the plot (complete and current, unlike any static list). */
export function NearbyLinks({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return null;
  const q = (w: string) => `https://www.google.com/maps/search/${encodeURIComponent(w)}/@${lat},${lng},15z`;
  return (
    <div className="muted flex flex-wrap gap-x-2">🔎 قريب منه:
      {[['مدارس', 'مدارس'], ['مساجد', 'مسجد'], ['مستشفيات', 'مستشفى'], ['مولات', 'مول'], ['حدائق', 'حديقة']].map(([l, w]) => <a key={l} href={q(w)} target="_blank" rel="noreferrer" className="text-brand-600">{l}</a>)}
    </div>
  );
}

export default function AssetInsights({ ins, area, price, deposit, asset }: { ins?: Insights | null; area?: number | null; price?: number | null; deposit?: number | null; asset?: AssetLike }) {
  const feat = asset ? featuresLabel(asset) : null;
  if (!ins) return feat ? <div className="text-xs">🛣️ {feat}</div> : null;
  const v = ins.verdict ? VERDICT[ins.verdict] : null;
  const calc = new URLSearchParams({ ...(price ? { price: String(Math.round(price)) } : ins.maxBid ? { price: String(ins.maxBid) } : {}), ...(area ? { area: String(area) } : {}), ...(deposit ? { deposit: String(Math.round(deposit)) } : {}), ...(ins.benchPpm ? { bench: String(ins.benchPpm) } : {}) });
  return (
    <div className="flex flex-col gap-1 text-xs">
      {v && ins.diffPct != null && (
        <div className={`rounded-md px-2 py-1 ${v.cls}`}>
          {v.dot} <b>{v.label}</b>{ins.verdict !== 'near' && <> بـ <span className="num">{pct(ins.diffPct)}</span></>}
          <span className="num"> · القطعة {sar(ins.plotPpm)} مقابل الحي {sar(ins.benchPpm)} ريال/م²{ins.benchKind === 'commercial' ? ' (تجاري)' : ''}</span>
        </div>
      )}
      {!v && ins.benchPpm != null && (
        <div className="muted">{ins.benchKind === 'commercial' ? 'وسيط سعر المتر التجاري في الحي:' : 'وسيط سعر متر الأراضي في الحي:'} <span className="num">{sar(ins.benchPpm)}</span> ريال (<span className="num">{ins.benchDeals}</span> صفقة)</div>
      )}
      {ins.trend && <TrendLine trend={ins.trend} />}
      {ins.maxBid != null && (
        <div>💡 حد أعلى مقترح للمزايدة: <b className="num">{sar(ins.maxBid)}</b> ريال <Link href={`/calculator?${calc}`} className="text-brand-600">· الحاسبة</Link></div>
      )}
      {ins.metro && (
        <div className="muted">🚇 <span className="num">{ins.metro.km}</span> كم — محطة {ins.metro.name} <span style={{ color: ins.metro.colour }}>●</span> {ins.metro.line}</div>
      )}
      {feat && <div>🛣️ {feat}</div>}
      {ins.projects && <div className="muted">🏗️ {ins.projects.map((p) => `${p.km} كم من ${p.name}`).join(' · ')}</div>}
      <NearbyLinks lat={asset?.latitude} lng={asset?.longitude} />
      {ins.whiteLand && (
        <div className="text-amber-700 dark:text-amber-300">⚠️ قد تخضع لرسوم الأراضي البيضاء (5,000 م² فأكثر) — <a href="https://idlelands.momah.gov.sa" target="_blank" rel="noreferrer" className="underline">تحقق</a></div>
      )}
      {(v || ins.maxBid != null) && <div className="muted text-[11px]">تقدير من صفقات وزارة العدل في الحي ({ins.benchKind === 'commercial' ? 'وسيط الصفقات التجارية' : 'وسيط سعر الأراضي السكنية'}) — ليس تقييماً رسمياً.</div>}
    </div>
  );
}

const qShort = (q: string) => q.replace(/^\d{2}(\d{2})-Q(\d)$/, 'ر$2 $1');
/** "اتجاه سعر الحي: ر4 25: 1,200 → ر1 26: 1,250 → ر2 26: 1,300 (▲ 8%)" */
function TrendLine({ trend }: { trend: { q: string; ppm: number }[] }) {
  const first = trend[0].ppm, last = trend[trend.length - 1].ppm;
  const ch = (last - first) / first;
  const arrow = Math.abs(ch) < 0.03 ? '◀▶ مستقر' : ch > 0 ? `▲ ${Math.round(ch * 100)}%` : `▼ ${Math.round(-ch * 100)}%`;
  return (
    <div className="muted">📈 اتجاه سعر الحي: <span className="num">{trend.map((t) => `${qShort(t.q)}: ${sar(t.ppm)}`).join(' ← ')}</span> <b className={ch > 0.03 ? 'text-rose-600' : ch < -0.03 ? 'text-emerald-600' : ''}>({arrow})</b></div>
  );
}

/** Source description + remarks (e.g. Infath), shortened. */
export function AssetNotes({ description, notes, clamp = true }: { description?: string | null; notes?: string | null; clamp?: boolean }) {
  if (!description && !notes) return null;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {description && <p className={`muted whitespace-pre-line ${clamp ? 'line-clamp-2' : ''}`}>📝 {description}</p>}
      {notes && <p className={`whitespace-pre-line text-amber-800 dark:text-amber-200 ${clamp ? 'line-clamp-2' : ''}`}>📌 {notes}</p>}
    </div>
  );
}
