'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type L = { href: string; label: string };
/** The four places people go most; everything else sits in two small menus (desktop) or "المزيد" (phone). */
const MAIN: L[] = [
  { href: '/', label: 'المزادات' },
  { href: '/properties', label: 'العقارات' },
  { href: '/map', label: 'الخريطة' },
  { href: '/good-deals', label: 'فرص أقل من السوق' },
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

function Menu({ label, items, path, badge }: { label: string; items: L[]; path: string; badge?: number }) {
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
        className={`relative flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold ${here ? 'text-[var(--accent)]' : 'muted hover:text-[var(--text)]'}`}>
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        {!!badge && <span className="num absolute -top-0.5 left-0.5 rounded-full bg-[var(--danger)] px-1.5 text-[10px] leading-4 text-white">{badge > 99 ? '99+' : badge}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
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

  const tab = (l: L, short?: string) => (
    <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive(path, l.href) ? 'text-[var(--accent)]' : 'muted'}`}>
      <span className={`h-1 w-6 rounded-full ${isActive(path, l.href) ? 'bg-[var(--accent)]' : 'bg-transparent'}`} />
      {short ?? l.label}
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-bold">
            <Mark />
            رادار المزادات
          </Link>
          <nav className="hidden flex-1 items-center gap-0.5 md:flex" aria-label="الأقسام">
            {MAIN.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${isActive(path, l.href) ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'muted hover:text-[var(--text)]'}`}>
                {l.label}
              </Link>
            ))}
            <Menu label="أدوات" items={TOOLS} path={path} />
          </nav>
          <div className="mr-auto hidden md:block"><Menu label="حسابي" items={ACCOUNT} path={path} badge={unread} /></div>
          <Link href="/notifications" className="relative mr-auto rounded-lg p-2 md:hidden" aria-label={`الإشعارات${unread ? ` (${unread} غير مقروءة)` : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
            {unread > 0 && <span className="num absolute right-0.5 top-0.5 rounded-full bg-[var(--danger)] px-1 text-[10px] leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
          </Link>
        </div>
      </header>

      {/* phone: bottom tab bar with the four main places + "المزيد" */}
      <nav aria-label="الأقسام" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] md:hidden">
        {more && (
          <div className="grid grid-cols-2 gap-1 border-b border-[var(--border)] p-2">
            {[...TOOLS, ...ACCOUNT].map((l) => (
              <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive(path, l.href) ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--sunk)]'}`}>{l.label}</Link>
            ))}
          </div>
        )}
        <div className="flex">
          {tab(MAIN[0])}{tab(MAIN[1])}{tab(MAIN[2])}{tab(MAIN[3], 'الفرص')}
          <button onClick={() => setMore((v) => !v)} aria-expanded={more}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${more || [...TOOLS, ...ACCOUNT].some((l) => isActive(path, l.href)) ? 'text-[var(--accent)]' : 'muted'}`}>
            <span className={`h-1 w-6 rounded-full ${[...TOOLS, ...ACCOUNT].some((l) => isActive(path, l.href)) ? 'bg-[var(--accent)]' : 'bg-transparent'}`} />
            {more ? 'إغلاق' : 'المزيد'}
          </button>
        </div>
      </nav>
    </>
  );
}
