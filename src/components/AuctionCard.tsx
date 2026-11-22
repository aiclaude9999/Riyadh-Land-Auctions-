'use client';
import Link from 'next/link';
import { Countdown } from './Countdown';
import { Cover } from './Cover';
import { Icon } from './Icon';
import { STATUS_STYLE, catLabel, fmtArea, fmtMoney, formatRiyadh, statusLabel, usageLabel } from './format';

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
  const sources = [...new Map(a.listings.map((l) => [l.sourceId, l])).values()];
  const landLine = a.landCount ? `${a.landCount} ${a.landCount === 1 ? 'قطعة أرض' : a.landCount <= 10 ? 'قطع أراضٍ' : 'قطعة أرض'}` : 'أراضٍ';
  const row = (k: string, v: React.ReactNode, strong = false) => (
    <div className="flex items-baseline justify-between gap-2"><span className="muted">{k}</span><span className={`num ${strong ? 'text-[15px] font-bold' : ''}`}>{v}</span></div>
  );
  return (
    <article className="card lift flex flex-col overflow-hidden">
      <Link href={`/auctions/${a.id}`} className="relative block">
        <Cover src={img} ratio="aspect-[16/9]"
          figure={a.hasLand && a.landAreaSqm ? fmtArea(a.landAreaSqm) : null}
          caption={a.hasLand ? landLine : `${catLabel(a.category)}${a.assetCount ? ` · ${a.assetCount} أصل` : ''}`} />
        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
          <span className={`chip ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
          {isNew && <span className="chip bg-[var(--card)] text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]">جديد</span>}
          {a.isMultiLocation && <span className="chip chip-quiet">متعدد المواقع</span>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/auctions/${a.id}`} className="line-clamp-2 text-[15px] font-bold leading-snug hover:text-[var(--accent)]">{a.title}</Link>
          {onToggleSave && (
            <button onClick={() => onToggleSave(a)} aria-label={a.saved ? 'إزالة من المحفوظة' : 'حفظ المزاد'} aria-pressed={!!a.saved}
              className={`press -m-1 rounded-md p-1 transition-colors ${a.saved ? 'text-[var(--accent)]' : 'muted hover:text-[var(--text)]'}`}>
              <Icon name="star" size={20} fill={!!a.saved} />
            </button>
          )}
        </div>
        <div className="muted text-xs">{place ?? 'الموقع غير متوفر'}{a.isMultiLocation && a.cities.length > 1 ? ` · ${a.cities.length} مدن` : ''}{a.organizer ? <> · <span className="truncate">{a.organizer}</span></> : null}</div>
        {a.usages.length || (a.hasLand && img) ? (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {a.hasLand && img && <span className="chip bg-[var(--accent-soft)] text-[var(--accent)]">{landLine}{a.landAreaSqm ? <span className="num"> · {fmtArea(a.landAreaSqm)}</span> : null}</span>}
            {a.usages.map((u) => <span key={u} className="chip chip-quiet">{usageLabel(u)}</span>)}
          </div>
        ) : null}
        {a.saved && (a.saved.note || a.saved.maxBid != null) && (
          <div className="rounded-md bg-[var(--accent-soft)] px-2 py-1.5 text-xs">
            {a.saved.maxBid != null && <div>حدي الأعلى: <b className="num">{fmtMoney(Number(a.saved.maxBid))}</b></div>}
            {a.saved.note && <div className="line-clamp-2">{a.saved.note}</div>}
            {a.saved.checklist && a.saved.checklist.length > 0 && <div className="muted num">{a.saved.checklist.length} من قائمة التحقق ✓</div>}
          </div>
        )}
        <div className="mt-auto space-y-1 border-t border-[var(--border)] pt-2 text-xs">
          {a.status === 'live' && a.endAt
            ? row('يغلق خلال', <Countdown to={a.endAt} compact />)
            : a.status === 'upcoming' && a.startAt ? row('يبدأ', formatRiyadh(a.startAt)) : null}
          {row('الإغلاق', formatRiyadh(a.endAt))}
          {a.deposit != null && row(`العربون${a.assetCount && a.assetCount > 1 ? ' (من)' : ''}`, fmtMoney(a.deposit))}
          {row(a.currentPrice ? 'آخر سعر' : a.startPrice ? (a.assetCount && a.assetCount > 1 ? 'يبدأ من' : 'سعر البداية') : 'الأصول',
            price ? fmtMoney(price) : a.assetCount != null ? `${a.assetCount} أصل` : '—', true)}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {sources.map((l) => (
            <a key={l.sourceId} href={l.url} target="_blank" rel="noreferrer" className="link">{sourceNames[l.sourceId] ?? l.sourceId} ↗</a>
          ))}
        </div>
      </div>
    </article>
  );
}
