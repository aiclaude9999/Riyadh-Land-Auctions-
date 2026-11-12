'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/', label: 'المزادات' },
  { href: '/properties', label: 'العقارات' },
  { href: '/map', label: 'الخريطة' },
  { href: '/good-deals', label: 'فرص أقل من السوق' },
  { href: '/calculator', label: 'الحاسبة' },
  { href: '/saved', label: 'المحفوظة' },
  { href: '/sources', label: 'المصادر' },
  { href: '/notifications', label: 'الإشعارات' },
  { href: '/settings', label: 'الإعدادات' },
];

export function Nav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const load = () => fetch('/api/notifications?unread=1').then((r) => r.json()).then((d) => setUnread(d.unread ?? 0)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [path]);
  if (path === '/login') return null;
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">◎</span>
          رادار المزادات
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${path === l.href ? 'bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-100' : 'muted hover:text-[var(--text)]'}`}>
              {l.label}
              {l.href === '/notifications' && unread > 0 && (
                <span className="num absolute -top-1 -left-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unread > 99 ? '99+' : unread}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
