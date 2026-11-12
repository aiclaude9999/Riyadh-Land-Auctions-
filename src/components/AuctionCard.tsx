'use client';
import Link from 'next/link';
import { Countdown } from './Countdown';
import { CAT_ICON, STATUS_STYLE, catLabel, fmtArea, fmtMoney, formatRiyadh, statusLabel, usageLabel } from './format';

export interface AuctionItem {
  id: string; title: string; category: string; status: string; startAt: string | null; endAt: string | null;
  city: string | null; district: string | null; cities: string[]; isMultiLocation: boolean; hasRiyadhCity: boolean;
  hasLand: boolean; landCount: number | null; landAreaSqm: number | null; propertyTypes: string[]; usages: string[];
  assetCount: number | null; startPrice: number | null; currentPrice: number | null; deposit: number | null;
  images: string[]; organizer: string | null; firstSeenAt: string; locationText: string | null;
  listings: { sourceId: string; url: string }[]; saved: { id: string; note?: string | null; maxBid?: number | string | null; checklist?: string[] } | null;
}

export function AuctionCard({ a, sourceNames, onToggleSave }: { a: AuctionItem; sourceNames: Record<string, string>; onToggleSave?: (a: AuctionItem) => void }) {
  const img = a.images[0];
  const place = [a.district, a.city].filter(Boolean).join('، ') || a.locationText || (a.cities.length ? a.cities.join('، ') : null);
  const price = a.currentPrice ?? a.startPrice;
  const isNew = Date.now() - new Date(a.firstSeenAt).getTime() < 86_400_000;
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/auctions/${a.id}`} className="relative block aspect-[16/9] bg-brand-50 dark:bg-brand-900/40">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" referrerPolicy="no-referrer"
            onError={(e) => ((e.currentTarget.style.display = 'none'))} />
        ) : (
          <div className="grid h-full place-items-center text-5xl opacity-60">{CAT_ICON[a.category] ?? '📦'}</div>
        )}
        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
          <span className={`chip ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
          <span className="chip bg-white/90 text-zinc-800">{CAT_ICON[a.category]} {catLabel(a.category)}</span>
          {isNew && <span className="chip bg-amber-400 text-amber-950">جديد</span>}
          {a.isMultiLocation && <span className="chip bg-violet-600 text-white">متعدد المواقع</span>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/auctions/${a.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-brand-600">{a.title}</Link>
          {onToggleSave && (
            <button onClick={() => onToggleSave(a)} title={a.saved ? 'إزالة من المحفوظة' : 'حفظ المزاد'} className="text-xl leading-none">
              {a.saved ? '★' : '☆'}
            </button>
          )}
        </div>
        <div className="muted text-xs">📍 {place ?? 'الموقع غير متوفر'}{a.isMultiLocation && a.cities.length > 1 ? ` (${a.cities.length} مدن)` : ''}</div>
        {a.hasLand && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="chip bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
              🟫 {a.landCount ? `${a.landCount} ${a.landCount === 1 ? 'قطعة أرض' : a.landCount <= 10 ? 'قطع أراضٍ' : 'قطعة أرض'}` : 'أراضٍ'}{a.landAreaSqm ? ` · ${fmtArea(a.landAreaSqm)}` : ''}
            </span>
            {a.usages.map((u) => <span key={u} className="chip border border-[var(--border)]">{usageLabel(u)}</span>)}
          </div>
        )}
        {a.organizer && <div className="muted truncate text-xs">🏢 {a.organizer}</div>}
        {a.saved && (a.saved.note || a.saved.maxBid != null) && (
          <div className="rounded-md bg-brand-50 px-2 py-1 text-xs dark:bg-brand-900/40">
            {a.saved.maxBid != null && <div>🎯 حدي الأعلى: <b className="num">{fmtMoney(Number(a.saved.maxBid))}</b></div>}
            {a.saved.note && <div className="line-clamp-2">📝 {a.saved.note}</div>}
            {a.saved.checklist && a.saved.checklist.length > 0 && <div className="muted num">✔ {a.saved.checklist.length} من قائمة التحقق</div>}
          </div>
        )}
        <div className="mt-auto space-y-1 border-t border-[var(--border)] pt-2 text-xs">
          {a.status === 'live' && a.endAt ? (
            <div className="flex items-center justify-between"><span className="muted">يغلق خلال</span><Countdown to={a.endAt} compact /></div>
          ) : a.status === 'upcoming' && a.startAt ? (
            <div className="flex items-center justify-between"><span className="muted">يبدأ</span><span className="num">{formatRiyadh(a.startAt)}</span></div>
          ) : null}
          {a.deposit != null && <div className="flex items-center justify-between"><span className="muted">العربون{a.assetCount && a.assetCount > 1 ? ' (من)' : ''}</span><span className="num">{fmtMoney(a.deposit)}</span></div>}
          <div className="flex items-center justify-between"><span className="muted">الإغلاق</span><span className="num">{formatRiyadh(a.endAt)}</span></div>
          <div className="flex items-center justify-between">
            <span className="muted">{a.currentPrice ? 'آخر سعر' : a.startPrice ? (a.assetCount && a.assetCount > 1 ? 'يبدأ من' : 'سعر البداية') : 'الأصول'}</span>
            <span className="num font-semibold">{price ? fmtMoney(price) : a.assetCount != null ? `${a.assetCount} أصل` : '—'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {[...new Map(a.listings.map((l) => [l.sourceId, l])).values()].map((l) => (
            <a key={l.sourceId} href={l.url} target="_blank" rel="noreferrer" className="chip bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900 dark:text-brand-100">
              {sourceNames[l.sourceId] ?? l.sourceId} ↗
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
