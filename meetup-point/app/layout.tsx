import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import LocaleProvider from '@/components/LocaleProvider';
import { DIR, isLocale, LOCALE_COOKIE, STRINGS, type Locale } from '@/lib/i18n';

async function currentLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = STRINGS[await currentLocale()];
  return {
    title: t.appTitle,
    description: t.appTagline,
    applicationName: t.appTitle,
    appleWebApp: { capable: true, title: t.appTitle, statusBarStyle: 'default' },
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1F6F5C' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  return (
    <html lang={locale} dir={DIR[locale]}>
      <body>
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
