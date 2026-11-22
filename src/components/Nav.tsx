'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type L = { href: string; label: string; icon?: keyof typeof ICONS };

/** Thin line icons drawn for this product (24px grid, 1.7 stroke, currentColor). */
const ICONS = {
  gavel: <><path d="m14.5 4.5 5 5" /><path d="m12 7 5 5" /><path d="m13.2 5.8 4.9 4.9-3.4 3.4-4.9-4.9z" /><path d="M11.3 11.3 4 18.6a1.4 1.4 0 0 0 2 2l7.3-7.3" /><path d="M14 21h7" /></>,
  building: <><path d="M4 21V5.5L12 3v18" /><path d="M12 9h8v12" /><path d="M3 21h18" /><path d="M7.5 8v.01M7.5 11.5v.01M7.5 15v.01M15.5 13v.01M15.5 16.5v.01" strokeWidth="2.2" strokeLinecap="round" /></>,
  map: <><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></>,
  deals: <><path d="M3 12.5V4h8.5l9 9-8.5 8.5z" /><circle cx="7.5" cy="8.5" r="1.3" /><path d="m11 13 2.5 2.5 3-5" /></>,
  tools: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
};
function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{ICONS[name]}</svg>;
}
/** The four places people go most; everything else sits in two small menus (desktop) or "المزيد" (phone). */
const MAIN: L[] = [
  { href: '/', label: 'المزادات', icon: 'gavel' },
  { href: '/properties', label: 'العقارات', icon: 'building' },
  { href: '/map', label: 'الخريطة', icon: 'map' },
  { href: '/good-deals', label: 'الفرص', icon: 'deals' },
];
const TOOLS: L[] = [
  { href: '/market', label: 'السوق' },
  { href: '/calendar', label: 'التقويم' },
  { href: '/calculator', label: 'الحاسبة' },
  { href: '/compare', label: 'المقارنة' },
];
const ACCOUNT: L[] = [
  { href: '/saved', label: 'المحفوظة' },
  { href: '/notifications', label: 'الإشعارات' },
  { href: '/sources', label: 'المصادر' },
  { href: '/settings', label: 'الإعدادات' },
];

/** Radar mark: a sweep over a plot — the product's name drawn. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="var(--accent-ink)" strokeOpacity=".45" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5" fill="none" stroke="var(--accent-ink)" strokeOpacity=".45" strokeWidth="1.5" />
      <path d="M16 16 L16 6 A10 10 0 0 1 25.5 13 Z" fill="var(--accent-ink)" fillOpacity=".9" />
      <circle cx="21" cy="11.5" r="1.6" fill="var(--accent)" />
    </svg>
  );
}

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

function Menu({ label, icon, items, path, badge }: { label: string; icon: keyof typeof ICONS; items: L[]; path: string; badge?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const here = items.some((i) => isActive(path, i.href));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        className={`relative flex h-16 items-center gap-2 px-3 text-[14px] font-semibold transition-colors ${here || open ? 'text-[var(--accent)]' : 'muted hover:text-[var(--text)]'}`}>
        <Icon name={icon} />
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        {!!badge && <span className="num absolute right-1.5 top-3.5 min-w-4 rounded-full bg-[var(--danger)] px-1 text-center text-[10px] leading-4 text-white ring-2 ring-[var(--card)]">{badge > 99 ? '99+' : badge}</span>}
        {here && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-[calc(100%-6px)] z-30 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[0_12px_32px_-12px_rgba(16,33,27,.25)]">
          {items.map((i) => (
            <Link key={i.href} role="menuitem" href={i.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${isActive(path, i.href) ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]' : 'hover:bg-[var(--sunk)]'}`}>
              {i.label}
              {i.href === '/notifications' && !!badge && <span className="num rounded-full bg-[var(--danger)] px-1.5 text-[10px] leading-4 text-white">{badge}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const load = () => fetch('/api/notifications?unread=1').then((r) => r.json()).then((d) => setUnread(d.unread ?? 0)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [path]);
  useEffect(() => setMore(false), [path]);
  if (path === '/login') return null;

  const tab = (l: L) => (
    <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? 'page' : undefined}
      className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold ${isActive(path, l.href) ? 'text-[var(--accent)]' : 'muted'}`}>
      {isActive(path, l.href) && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--accent)]" />}
      <Icon name={l.icon!} size={22} />
      {l.label}
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-[1100] border-b border-[var(--border)] bg-[var(--card)]">
        <div className="h-[3px] bg-[var(--accent)]" aria-hidden="true" />
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="flex flex-none items-center gap-2.5">
            <Mark size={34} />
            <span className="flex flex-col leading-tight">
              <span className="text-[17px] font-bold tracking-tight">رادار المزادات</span>
              <span className="muted text-[11px] font-medium">مزادات الأراضي والعقار · الرياض</span>
            </span>
          </Link>
          <nav className="hidden h-16 flex-1 items-stretch md:flex" aria-label="الأقسام">
            {MAIN.map((l) => {
              const on = isActive(path, l.href);
              return (
                <Link key={l.href} href={l.href} aria-current={on ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-3.5 text-[14px] font-semibold transition-colors ${on ? 'text-[var(--accent)]' : 'muted hover:text-[var(--text)]'}`}>
                  <Icon name={l.icon!} />
                  {l.label}
                  {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />}
                </Link>
              );
            })}
            <Menu label="أدوات" icon="tools" items={TOOLS} path={path} />
          </nav>
          <div className="mr-auto flex items-center gap-1">
            <Link href="/notifications" aria-label={`الإشعارات${unread ? ` (${unread} غير مقروءة)` : ''}`}
              className={`relative grid h-10 w-10 place-items-center rounded-full border transition-colors ${isActive(path, '/notifications') ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] muted hover:border-[var(--border-strong)] hover:text-[var(--text)]'}`}>
              <Icon name="bell" />
              {unread > 0 && <span className="num absolute -right-1 -top-1 min-w-4 rounded-full bg-[var(--danger)] px-1 text-center text-[10px] leading-4 text-white ring-2 ring-[var(--card)]">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <div className="hidden md:block"><Menu label="حسابي" icon="user" items={ACCOUNT.filter((l) => l.href !== '/notifications')} path={path} /></div>
          </div>
        </div>
      </header>

      {/* phone: bottom tab bar with the four main places + "المزيد" */}
      <nav aria-label="الأقسام" className="fixed inset-x-0 bottom-0 z-[1100] border-t border-[var(--border)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] md:hidden">
        {more && (
          <div className="grid grid-cols-2 gap-1 border-b border-[var(--border)] p-2">
            {[...TOOLS, ...ACCOUNT].map((l) => (
              <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive(path, l.href) ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--sunk)]'}`}>{l.label}</Link>
            ))}
          </div>
        )}
        <div className="flex">
          {MAIN.map(tab)}
          <button onClick={() => setMore((v) => !v)} aria-expanded={more}
            className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold ${more || [...TOOLS, ...ACCOUNT].some((l) => isActive(path, l.href)) ? 'text-[var(--accent)]' : 'muted'}`}>
            {[...TOOLS, ...ACCOUNT].some((l) => isActive(path, l.href)) && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--accent)]" />}
            <Icon name="tools" size={22} />
            {more ? 'إغلاق' : 'المزيد'}
          </button>
        </div>
      </nav>
    </>
  );
}
