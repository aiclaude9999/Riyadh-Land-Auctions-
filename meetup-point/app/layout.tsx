import type { Metadata, Viewport } from 'next';
import './globals.css';
import { locale, t } from '@/lib/i18n';

export const metadata: Metadata = { title: t.appTitle, description: t.appTagline };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={locale.lang} dir={locale.dir}>
      <body>{children}</body>
    </html>
  );
}
