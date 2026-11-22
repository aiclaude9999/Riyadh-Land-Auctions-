import Link from 'next/link';
import type { Insights } from '@/lib/insights';
import { featuresLabel } from '@/lib/plot';
import { Icon, type IconName } from './Icon';

const sar = (n?: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (d: number) => `${Math.abs(Math.round(d * 100))}%`;

export const VERDICT: Record<NonNullable<Insights['verdict']>, { label: string; cls: string; dot: string; color: string }> = {
  below: { label: 'أقل من سعر الحي', cls: 'bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-800', dot: '●', color: '#0f7a4f' },
  near: { label: 'قريب من سعر الحي', cls: 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-800', dot: '●', color: '#b7791f' },
  above: { label: 'أعلى من سعر الحي', cls: 'bg-rose-50 text-rose-900 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/60 dark:text-rose-100 dark:ring-rose-800', dot: '●', color: '#c0392b' },
};

/** The price check as a mark on a card's picture: green below the district price, amber near, red above. */
export function PriceMark({ verdict, diff }: { verdict: NonNullable<Insights['verdict']>; diff?: number | null }) {
  const v = VERDICT[verdict];
  const short = verdict === 'below' ? 'أقل من الحي' : verdict === 'above' ? 'أعلى من الحي' : 'قريب من الحي';
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: v.color }} title={v.label}>
      {short}{verdict !== 'near' && diff != null && <span className="num">{Math.abs(Math.round(diff * 100))}%</span>}
    </span>
  );
}

/** One fact line with its icon. */
function Line({ icon, children, className = 'muted' }: { icon: IconName; children: React.ReactNode; className?: string }) {
  return <div className={`flex items-start gap-1.5 ${className}`}><Icon name={icon} size={14} className="mt-0.5" /><div className="min-w-0">{children}</div></div>;
}

/** Price check, suggested max bid, metro distance and white-land warning for one asset (Riyadh only). */
interface AssetLike { streetSides?: number | null; streetWidth?: number | null; corner?: boolean | null; latitude?: number | null; longitude?: number | null }

/** Google Maps searches around the plot (complete and current, unlike any static list). */
export function NearbyLinks({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return null;
  const q = (w: string) => `https://www.google.com/maps/search/${encodeURIComponent(w)}/@${lat},${lng},15z`;
  return (
    <Line icon="search"><span className="flex flex-wrap gap-x-2">قريب منه:
      {[['مدارس', 'مدارس'], ['مساجد', 'مسجد'], ['مستشفيات', 'مستشفى'], ['مولات', 'مول'], ['حدائق', 'حديقة']].map(([l, w]) => <a key={l} href={q(w)} target="_blank" rel="noreferrer" className="link font-medium">{l}</a>)}
    </span></Line>
  );
}

export default function AssetInsights({ ins, area, price, deposit, asset }: { ins?: Insights | null; area?: number | null; price?: number | null; deposit?: number | null; asset?: AssetLike }) {
  const feat = asset ? featuresLabel(asset) : null;
  if (!ins) return feat ? <div className="text-xs"><Line icon="road" className="">{feat}</Line></div> : null;
  const v = ins.verdict ? VERDICT[ins.verdict] : null;
  const calc = new URLSearchParams({ ...(price ? { price: String(Math.round(price)) } : ins.maxBid ? { price: String(ins.maxBid) } : {}), ...(area ? { area: String(area) } : {}), ...(deposit ? { deposit: String(Math.round(deposit)) } : {}), ...(ins.benchPpm ? { bench: String(ins.benchPpm) } : {}) });
  return (
    <div className="flex flex-col gap-1 text-xs">
      {v && ins.diffPct != null && (
        <div className={`rounded-md px-2 py-1 ${v.cls}`}>
          <span style={{ color: v.color }}>●</span> <b>{v.label}</b>{ins.verdict !== 'near' && <> بـ <span className="num">{pct(ins.diffPct)}</span></>}
          <span className="num"> · القطعة {sar(ins.plotPpm)} مقابل الحي {sar(ins.benchPpm)} ريال/م²{ins.benchKind === 'commercial' ? ' (تجاري)' : ''}</span>
        </div>
      )}
      {!v && ins.benchPpm != null && (
        <div className="muted">{ins.benchKind === 'commercial' ? 'وسيط سعر المتر التجاري في الحي:' : 'وسيط سعر متر الأراضي في الحي:'} <span className="num">{sar(ins.benchPpm)}</span> ريال (<span className="num">{ins.benchDeals}</span> صفقة)</div>
      )}
      {ins.trend && <TrendLine trend={ins.trend} />}
      {ins.maxBid != null && (
        <Line icon="target" className="">حد أعلى مقترح للمزايدة: <b className="num">{sar(ins.maxBid)}</b> ريال · <Link href={`/calculator?${calc}`} className="link">الحاسبة</Link></Line>
      )}
      {ins.metro && (
        <Line icon="metro"><span className="num">{ins.metro.km}</span> كم — محطة {ins.metro.name} <span style={{ color: ins.metro.colour }}>●</span> {ins.metro.line}</Line>
      )}
      {feat && <Line icon="road" className="">{feat}</Line>}
      {ins.projects && <Line icon="crane">{ins.projects.map((p) => `${p.km} كم من ${p.name}`).join(' · ')}</Line>}
      <NearbyLinks lat={asset?.latitude} lng={asset?.longitude} />
      {ins.whiteLand && (
        <Line icon="warning" className="text-amber-800 dark:text-amber-300">قد تخضع لرسوم الأراضي البيضاء (5,000 م² فأكثر) — <a href="https://idlelands.momah.gov.sa" target="_blank" rel="noreferrer" className="underline">تحقق</a></Line>
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
    <Line icon="trend">اتجاه سعر الحي: <span className="num">{trend.map((t) => `${qShort(t.q)}: ${sar(t.ppm)}`).join(' ← ')}</span> <b className={ch > 0.03 ? 'text-rose-600' : ch < -0.03 ? 'text-emerald-600' : ''}>({arrow})</b></Line>
  );
}

/** Source description + remarks (e.g. Infath), shortened. */
export function AssetNotes({ description, notes, clamp = true }: { description?: string | null; notes?: string | null; clamp?: boolean }) {
  if (!description && !notes) return null;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {description && <Line icon="note"><p className={`whitespace-pre-line ${clamp ? 'line-clamp-2' : ''}`}>{description}</p></Line>}
      {notes && <Line icon="pin" className="text-amber-900 dark:text-amber-200"><p className={`whitespace-pre-line ${clamp ? 'line-clamp-2' : ''}`}>{notes}</p></Line>}
    </div>
  );
}
