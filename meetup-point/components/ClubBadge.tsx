import Logo from './Logo';
import type { Theme } from '@/lib/themes';

/** Shield in the club's colours with its initial (not the official logo). The default theme shows the app logo. */
export default function ClubBadge({ theme, locale, size = 36 }: { theme: Theme; locale: 'en' | 'ar'; size?: number }) {
  if (theme.id === 'riyadh') return <Logo size={size} color={theme.brand} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (theme.logo) return <img src={`/clubs/${theme.id}.webp`} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" aria-hidden>
      <path d="M20 2 L37 8 V22 C37 32 29 39 20 42 C11 39 3 32 3 22 V8 Z" fill={theme.brand} stroke={theme.accent} strokeWidth="3" />
      <path d="M4.5 30 C11 27.5 29 27.5 35.5 30 C34.5 32.5 33 34.5 31 36 C25 33.5 15 33.5 9 36 C7 34.5 5.5 32.5 4.5 30 Z" fill={theme.accent} opacity=".9" />
      <text x="20" y="16.5" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={theme.accent === '#1A1A1A' || theme.accent === '#1E3A8A' ? '#FFFFFF' : theme.accent} fontFamily="IBM Plex Sans Arabic, sans-serif">
        {theme.initial[locale]}
      </text>
    </svg>
  );
}
